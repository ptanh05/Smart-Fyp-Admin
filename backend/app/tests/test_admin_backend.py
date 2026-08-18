from django.test import TestCase
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status
from app.models import CustomUser, AuditLog

class AdminBackendTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = CustomUser.objects.create_user(
            username="admin_test",
            email="admin@utc.edu.vn",
            password="adminpassword123",
            user_type="admin",
            is_staff=True,
        )
        self.student_user = CustomUser.objects.create_user(
            username="student_test",
            email="student@utc.edu.vn",
            password="testpassword123",
            user_type="student",
        )
        self.supervisor_user = CustomUser.objects.create_user(
            username="supervisor_test",
            email="supervisor@utc.edu.vn",
            password="testpassword123",
            user_type="supervisor",
        )
        self.committee_user = CustomUser.objects.create_user(
            username="committee_test",
            email="committee@utc.edu.vn",
            password="testpassword123",
            user_type="committee_member",
        )
        self.external_user = CustomUser.objects.create_user(
            username="external_test",
            email="external@utc.edu.vn",
            password="testpassword123",
            user_type="external_examiner",
        )

    def test_health_check(self):
        response = self.client.get("/app/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")

    def test_database_health_check(self):
        response = self.client.get("/app/health/database/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "healthy")

    # =========================================================================
    # Admin Registration Tests
    # =========================================================================
    def test_admin_registration_success(self):
        secret = getattr(settings, "ADMIN_REGISTRATION_SECRET", "utc-smart-fyp-admin-secret-key-2026")
        response = self.client.post("/app/admin/register/", {
            "username": "new_admin",
            "email": "newadmin@utc.edu.vn",
            "password": "SecurePassword123!",
            "admin_secret": secret,
            "role": "student" # Malicious role override attempt must be ignored
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_user = CustomUser.objects.get(username="new_admin")
        self.assertEqual(created_user.user_type, "admin")
        self.assertTrue(created_user.is_staff)
        self.assertTrue(AuditLog.objects.filter(user=created_user).exists())

    def test_admin_registration_invalid_secret(self):
        response = self.client.post("/app/admin/register/", {
            "username": "unauthorized_admin",
            "email": "hacker@utc.edu.vn",
            "password": "SecurePassword123!",
            "admin_secret": "wrong-secret-key"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(CustomUser.objects.filter(username="unauthorized_admin").exists())

    def test_admin_registration_duplicate_validation(self):
        secret = getattr(settings, "ADMIN_REGISTRATION_SECRET", "utc-smart-fyp-admin-secret-key-2026")
        response = self.client.post("/app/admin/register/", {
            "username": "admin_test", # duplicate username
            "email": "different_email@utc.edu.vn",
            "password": "SecurePassword123!",
            "admin_secret": secret
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # Admin Login Tests
    # =========================================================================
    def test_admin_login_success(self):
        response = self.client.post("/app/admin/login/", {
            "email": "admin@utc.edu.vn",
            "password": "adminpassword123",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user_type"], "admin")
        self.assertIn("refresh_token", response.cookies)

    def test_non_admin_login_rejected(self):
        for user in [self.student_user, self.supervisor_user, self.committee_user, self.external_user]:
            response = self.client.post("/app/admin/login/", {
                "email": user.email,
                "password": "testpassword123",
            }, format="json")
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, f"User {user.username} with role {user.user_type} was not rejected!")

    def test_admin_login_invalid_password(self):
        response = self.client.post("/app/admin/login/", {
            "email": "admin@utc.edu.vn",
            "password": "wrongpassword",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_login_deactivated_account(self):
        self.admin_user.is_active = False
        self.admin_user.save()
        response = self.client.post("/app/admin/login/", {
            "email": "admin@utc.edu.vn",
            "password": "adminpassword123",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # RBAC Protection Tests (Across All Roles)
    # =========================================================================
    def test_admin_rbac_protection_matrix(self):
        endpoints = [
            "/app/admin/users/",
            "/app/admin/security-center/",
            "/app/audit-logs/",
            "/app/audit-logs/stats/",
        ]
        
        for ep in endpoints:
            # 1. Unauthenticated -> 401
            self.client.logout()
            self.client.credentials()
            res = self.client.get(ep)
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED, f"Unauthenticated request to {ep} did not return 401")

            # 2. Authenticated Non-Admin Roles -> 403
            for non_admin in [self.student_user, self.supervisor_user, self.committee_user, self.external_user]:
                self.client.force_authenticate(user=non_admin)
                res = self.client.get(ep)
                self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN, f"Role {non_admin.user_type} was not forbidden from {ep}")

            # 3. Authenticated Admin -> 200
            self.client.force_authenticate(user=self.admin_user)
            res = self.client.get(ep)
            self.assertEqual(res.status_code, status.HTTP_200_OK, f"Admin was not allowed access to {ep}")

    # =========================================================================
    # Admin User Management & Account Provisioning Tests
    # =========================================================================
    def test_admin_create_managed_users(self):
        self.client.force_authenticate(user=self.admin_user)

        roles_to_test = [
            ("new_student", "new_student@utc.edu.vn", "student"),
            ("new_supervisor", "new_supervisor@utc.edu.vn", "supervisor"),
            ("new_committee", "new_committee@utc.edu.vn", "committee_member"),
            ("new_external", "new_external@utc.edu.vn", "external_examiner"),
        ]

        for username, email, role in roles_to_test:
            response = self.client.post("/app/admin/users/", {
                "username": username,
                "email": email,
                "password": "Password1234!",
                "user_type": role,
                "is_active": True
            }, format="json")
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, f"Failed to create user with role {role}: {response.data}")
            created = CustomUser.objects.get(username=username)
            self.assertEqual(created.user_type, role)
            self.assertEqual(created.email, email)

    def test_admin_update_user_status_and_role(self):
        self.client.force_authenticate(user=self.admin_user)

        # Deactivate user
        response = self.client.patch(f"/app/admin/users/{self.student_user.id}/", {
            "is_active": False
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student_user.refresh_from_db()
        self.assertFalse(self.student_user.is_active)

        # Change user role
        response = self.client.patch(f"/app/admin/users/{self.student_user.id}/", {
            "user_type": "supervisor"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student_user.refresh_from_db()
        self.assertEqual(self.student_user.user_type, "supervisor")

