from django.test import TestCase
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
            password="studentpassword123",
            user_type="student",
        )

    def test_health_check(self):
        response = self.client.get("/app/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")

    def test_database_health_check(self):
        response = self.client.get("/app/health/database/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "healthy")

    def test_admin_login_success(self):
        response = self.client.post("/app/admin/login/", {
            "email": "admin@utc.edu.vn",
            "password": "adminpassword123",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_non_admin_login_rejected(self):
        response = self.client.post("/app/admin/login/", {
            "email": "student@utc.edu.vn",
            "password": "studentpassword123",
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_rbac_protection(self):
        # Unauthenticated request
        response = self.client.get("/app/admin/users/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Authenticated Admin request
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/app/admin/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Authenticated Student request (RBAC Deny)
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get("/app/admin/users/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
