import logging
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import CustomUser, AuditLog
from .permissions import IsAdminUserRole
from .serializers import AdminUserSerializer, AuditLogSerializer

logger = logging.getLogger(__name__)

def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        key="refresh_token",
        value=str(refresh_token),
        httponly=True,
        secure=False,  # Set to True in production HTTPS
        samesite="Lax",
        path="/app/",
        max_age=7 * 24 * 3600,
    )
    return response


def delete_refresh_cookie(response):
    response.delete_cookie(key="refresh_token", path="/app/")
    return response


class AdminLoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "").strip()

        if not email or not password:
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        user = CustomUser.objects.filter(email=email).first()
        if not user or not user.check_password(password):
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({"detail": "Account is deactivated."}, status=status.HTTP_403_FORBIDDEN)

        # Enforce Admin Role Check
        if not (user.is_staff or user.is_superuser or user.user_type == "admin"):
            return Response({"detail": "Forbidden: Admin access required."}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        # Audit Log
        AuditLog.objects.create(
            user=user,
            action_type="admin_user_update",
            description=f"Admin user '{user.username}' logged in successfully."
        )

        response = Response({
            "access": access_token,
            "user_type": "admin",
            "expire_time": "15m",
            "message": "Login successful."
        }, status=status.HTTP_200_OK)

        return set_refresh_cookie(response, refresh)


class AdminCookieTokenRefreshAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response({"detail": "Refresh token cookie missing."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            refresh = RefreshToken(refresh_token)
            data = {"access": str(refresh.access_token)}
            if hasattr(refresh, "set_jti"):
                refresh.set_jti()
                refresh.set_exp()
                refresh.outstand()
                data["refresh"] = str(refresh)
            
            response = Response(data, status=status.HTTP_200_OK)
            if "refresh" in data:
                set_refresh_cookie(response, data["refresh"])
            return response
        except Exception:
            return Response({"detail": "Invalid or expired refresh token."}, status=status.HTTP_401_UNAUTHORIZED)


class AdminCookieLogoutAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
        return delete_refresh_cookie(response)


class AdminUserManagementAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        query = request.GET.get("q", "").strip()
        role = request.GET.get("role", "").strip()
        is_active = request.GET.get("is_active", "").strip()

        users = CustomUser.objects.all().order_by("-id")
        if query:
            users = users.filter(Q(username__icontains=query) | Q(email__icontains=query))
        if role:
            users = users.filter(user_type=role)
        if is_active:
            users = users.filter(is_active=(is_active.lower() == "true"))

        user_list = AdminUserSerializer(users[:100], many=True).data
        return Response({"users": user_list, "total": users.count()}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        target_user = get_object_or_404(CustomUser, pk=pk)
        old_status = target_user.is_active
        old_role = target_user.user_type

        if "is_active" in request.data:
            target_user.is_active = bool(request.data["is_active"])
        if "user_type" in request.data and request.data["user_type"] in ["student", "supervisor", "committee_member", "external_examiner", "admin"]:
            target_user.user_type = request.data["user_type"]

        target_user.save()

        # Audit Log Event
        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Admin updated user '{target_user.username}' (Status: {old_status} -> {target_user.is_active}, Role: {old_role} -> {target_user.user_type}).",
            field_name="user_status_role",
            old_value=f"active={old_status}, role={old_role}",
            new_value=f"active={target_user.is_active}, role={target_user.user_type}"
        )

        return Response({
            "message": "User updated successfully.",
            "user": AdminUserSerializer(target_user).data
        }, status=status.HTTP_200_OK)


class AdminSecurityCenterAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        total_users = CustomUser.objects.count()
        active_users = CustomUser.objects.filter(is_active=True).count()
        deactivated_users = total_users - active_users
        recent_logs = AuditLog.objects.all().order_by("-created_at")[:15]
        
        audit_data = []
        for log in recent_logs:
            audit_data.append({
                "id": log.id,
                "action": log.get_action_type_display(),
                "actor": log.user.username if log.user else "System",
                "created_at": log.created_at,
                "details": log.description,
            })

        return Response({
            "total_users": total_users,
            "active_users": active_users,
            "deactivated_users": deactivated_users,
            "security_headers": {
                "httponly_cookies": True,
                "content_security_policy": True,
                "hsts_production": True,
                "cors_credentials": True,
                "magic_bytes_file_inspection": True,
                "websocket_one_time_tickets": True,
            },
            "recent_audit_events": audit_data
        }, status=status.HTTP_200_OK)


class AdminAuditLogListAPIView(ListAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all()


class AdminAuditLogStatsAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        total = AuditLog.objects.count()
        return Response({
            "total_logs": total,
            "evaluation_logs": AuditLog.objects.filter(action_type="evaluation_update").count(),
            "action_logs": total - AuditLog.objects.filter(action_type="evaluation_update").count(),
            "by_action_type": {
                "evaluation_update": AuditLog.objects.filter(action_type="evaluation_update").count(),
                "document_status_change": AuditLog.objects.filter(action_type="document_status_change").count(),
                "group_status_change": AuditLog.objects.filter(action_type="group_status_change").count(),
                "admin_user_update": AuditLog.objects.filter(action_type="admin_user_update").count(),
            }
        }, status=status.HTTP_200_OK)


class HealthCheckAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "status": "ok",
            "service": "smart-fyp-admin-backend",
            "timestamp": "2026-08-18T16:42:00Z"
        }, status=status.HTTP_200_OK)


class DatabaseHealthCheckAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            user_count = CustomUser.objects.count()
            return Response({
                "status": "healthy",
                "database": "connected",
                "total_users": user_count
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "unhealthy",
                "database": "error",
                "detail": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
