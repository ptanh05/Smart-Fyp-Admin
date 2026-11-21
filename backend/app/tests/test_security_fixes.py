"""
Security-fix regression tests (F1, F2, F3, F13, F20).

Runs against SQLite :memory: (IS_TESTING=True in settings).
No network, no Neon DB.
"""
from django.test import TestCase, override_settings
from django.conf import settings
from django.contrib.auth.hashers import check_password, identify_hasher
from rest_framework import status
from rest_framework.test import APIClient

from app.models import CustomUser


class LoginBackdoorRemovedTest(TestCase):
    """F1 — Backdoor password list must NOT grant login."""

    def _make_user(self, suffix):
        return CustomUser.objects.create_user(
            username=f"sec_user_{suffix}",
            email=f"sec_user_{suffix}@utc.edu.vn",
            password="RealPassword#2026!",
            user_type="admin",
            is_staff=True,
        )

    def _login(self, username, password):
        client = APIClient()
        return client.post(
            "/app/supervisor/login/",
            {"username": username, "password": password},
            format="json",
        )

    def test_backdoor_admin123_rejected(self):
        user = self._make_user("a1")
        resp = self._login(user.username, "Admin@123456")
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_429_TOO_MANY_REQUESTS])

    def test_backdoor_giaovu_rejected(self):
        user = self._make_user("g1")
        resp = self._login(user.username, "Giaovu@123456")
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_429_TOO_MANY_REQUESTS])

    def test_backdoor_123456_rejected(self):
        user = self._make_user("n1")
        resp = self._login(user.username, "123456")
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_429_TOO_MANY_REQUESTS])

    def test_backdoor_utc_rejected(self):
        user = self._make_user("u1")
        resp = self._login(user.username, "Utc@123456")
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_429_TOO_MANY_REQUESTS])

    def test_correct_password_still_works(self):
        user = self._make_user("ok")
        resp = self._login(user.username, "RealPassword#2026!")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)

    def test_backdoor_source_code_removed(self):
        """Code-level guard: source must not contain the backdoor list."""
        import inspect
        from app import views
        source = inspect.getsource(views.AdminLoginAPIView)
        self.assertNotIn("Admin@123456", source, "Backdoor password list must be removed (F1)")
        self.assertNotIn("Giaovu@123456", source)
        self.assertNotIn("Utc@123456", source)


class AdminRegistrationSecretEmptyTest(TestCase):
    """F2 — Empty ADMIN_REGISTRATION_SECRET must refuse registration (not use a default)."""

    def setUp(self):
        self.client = APIClient()

    @override_settings(ADMIN_REGISTRATION_SECRET="")
    def test_empty_secret_refuses_registration(self):
        # admin_secret must be non-empty to pass serializer validation;
        # the view then checks if the configured secret is set and returns 403
        resp = self.client.post(
            "/app/admin/register/",
            {
                "username": "attacker",
                "email": "attacker@evil.com",
                "password": "Pass123456!",
                "admin_secret": "any-string-wont-match-empty-configured",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(CustomUser.objects.filter(username="attacker").exists())

    @override_settings(ADMIN_REGISTRATION_SECRET="")
    def test_any_secret_refused_when_unset(self):
        """Even supplying the old leaked default must not work when env is unset."""
        resp = self.client.post(
            "/app/admin/register/",
            {
                "username": "attacker2",
                "email": "attacker2@evil.com",
                "password": "Pass123456!",
                "admin_secret": "utc-smart-fyp-admin-secret-key-2026",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class PasswordHasherTest(TestCase):
    """F3 — Excel importer must NOT use MD5 hasher for new user passwords."""

    def test_importer_does_not_call_make_password_with_md5(self):
        """
        Unit test: the importer source code must not contain 'hasher="md5"'.
        This is a code-level assertion that the backdoor hasher arg was removed.
        """
        import inspect
        from app.services import excel_importer
        source = inspect.getsource(excel_importer)
        self.assertNotIn(
            'hasher="md5"', source,
            "excel_importer.py must not call make_password with hasher='md5' (F3)"
        )
        self.assertNotIn(
            "hasher='md5'", source,
            "excel_importer.py must not call make_password with hasher='md5' (F3)"
        )

    @override_settings(PASSWORD_HASHERS=[
        'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    ])
    def test_make_password_default_uses_pbkdf2(self):
        """With PBKDF2 as default hasher, make_password produces PBKDF2 hash."""
        from django.contrib.auth.hashers import make_password
        hashed = make_password("TestPassword123!")
        hasher = identify_hasher(hashed)
        self.assertEqual(hasher.algorithm, "pbkdf2_sha256")


class DatabaseHealthCheckSecureTest(TestCase):
    """F20 — DatabaseHealthCheckAPIView must not expose total_users to anonymous callers."""

    def setUp(self):
        self.client = APIClient()
        # Create some users so total_users would be > 0 if leaked
        CustomUser.objects.create_user(username="u1", email="u1@utc.edu.vn", password="p", user_type="student")
        CustomUser.objects.create_user(username="u2", email="u2@utc.edu.vn", password="p", user_type="student")

    def test_health_check_ok(self):
        resp = self.client.get("/app/health/database/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "healthy")

    def test_total_users_not_in_response(self):
        resp = self.client.get("/app/health/database/")
        self.assertNotIn("total_users", resp.data,
                         "total_users must not be returned to anonymous callers (F20)")


class AllowedHostsNoWildcardTest(TestCase):
    """F13 — ALLOWED_HOSTS must not contain '*' on Render."""

    def test_no_wildcard_in_allowed_hosts(self):
        self.assertNotIn("*", settings.ALLOWED_HOSTS,
                         "Wildcard '*' must not appear in ALLOWED_HOSTS (F13)")
