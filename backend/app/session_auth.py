"""
JWT Session Tracking & Dynamic Security Policy Helpers (Shared Postgres Table aware).
"""
from django.core.cache import cache
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken

from .models import SecurityPolicy, UserSessionLog

DEFAULT_SECURITY_POLICIES = {
    "max_login_attempts": {
        "label": "Số lần đăng nhập sai tối đa trước khi khóa tạm",
        "value": "3",
        "description": "Áp dụng cho đăng nhập Cổng Quản trị, Sinh viên & Giảng viên (mặc định 3 lần).",
    },
    "lockout_minutes": {
        "label": "Thời gian khóa tạm khi sai mật khẩu (phút)",
        "value": "15",
        "description": "Số phút tạm khóa tài khoản sau khi vượt quá số lần thử sai.",
    },
    "session_idle_timeout_minutes": {
        "label": "Thời gian timeout phiên làm việc (phút)",
        "value": "480",
        "description": "Ngưỡng cảnh báo / kiểm soát phiên hoạt động trên hệ thống.",
    },
    "require_utc_sso_domain": {
        "label": "Giới hạn tên miền @utc.edu.vn cho SSO",
        "value": "true",
        "description": "Kiểm tra domain email trường khi đăng nhập qua Google SSO.",
    },
}


def ensure_default_security_policies():
    existing = {p.policy_key: p for p in SecurityPolicy.objects.all()}
    created = []
    for key, meta in DEFAULT_SECURITY_POLICIES.items():
        if key not in existing:
            obj, _ = SecurityPolicy.objects.get_or_create(
                policy_key=key,
                defaults={
                    "label": meta["label"],
                    "policy_value": meta["value"],
                    "description": meta["description"],
                },
            )
            created.append(obj)
    return list(SecurityPolicy.objects.all().order_by("policy_key"))


def get_security_policy_int(key: str, default_val: int) -> int:
    cache_key = f"sec_policy_{key}"
    cached = cache.get(cache_key)
    if cached is not None:
        try:
            return int(cached)
        except (TypeError, ValueError):
            return default_val
    try:
        policy = SecurityPolicy.objects.filter(policy_key=key).first()
        val = int(policy.policy_value) if policy else int(default_val)
        cache.set(cache_key, val, 30)
        return val
    except Exception:
        return default_val


def get_client_ip(request):
    if not request:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR") or None


def issue_tracked_session_tokens(user, request=None, portal: str = "admin"):
    """Mint Refresh/Access JWT embedded with `sid` and record UserSessionLog row."""
    refresh = RefreshToken.for_user(user)
    jti = str(refresh.get("jti") or "")
    refresh["sid"] = jti
    refresh["user_type"] = getattr(user, "user_type", "")

    session_log = None
    try:
        ip = get_client_ip(request)
        ua = (request.META.get("HTTP_USER_AGENT", "") if request else "")[:500]
        session_log = UserSessionLog.objects.create(
            user=user,
            token_jti=jti,
            portal=portal,
            ip_address=ip,
            user_agent=ua,
            is_active=True,
        )
    except Exception:
        pass

    access_token = str(refresh.access_token)
    return refresh, access_token, session_log


def revoke_session_by_jti(jti: str, revoked_by=None, reason: str = ""):
    if not jti:
        return
    try:
        cache.set(f"revoked_sid_{jti}", True, 86400)
        UserSessionLog.objects.filter(token_jti=jti, is_active=True).update(
            is_active=False,
            revoked_at=timezone.now(),
            revoked_by=revoked_by,
            revoke_reason=reason or "Logged out / revoked",
        )
    except Exception:
        pass


class SessionTrackingJWTAuthentication(JWTAuthentication):
    """Enforces remote session revocation against shared UserSessionLog."""

    def authenticate(self, request):
        res = super().authenticate(request)
        if res is None:
            return None
        user, validated_token = res
        sid = validated_token.get("sid")
        if sid:
            if cache.get(f"revoked_sid_{sid}"):
                raise AuthenticationFailed("Phiên đăng nhập đã bị thu hồi từ xa.")
            try:
                if UserSessionLog.objects.filter(token_jti=sid, is_active=False).exists():
                    cache.set(f"revoked_sid_{sid}", True, 86400)
                    raise AuthenticationFailed("Phiên đăng nhập đã bị thu hồi từ xa.")
                seen_key = f"seen_sid_{sid}"
                if not cache.get(seen_key):
                    UserSessionLog.objects.filter(token_jti=sid, is_active=True).update(
                        last_seen_at=timezone.now()
                    )
                    cache.set(seen_key, True, 60)
            except AuthenticationFailed:
                raise
            except Exception:
                pass
        return user, validated_token
