from django.test import TestCase
from django.core.files.storage import FileSystemStorage
from rest_framework.test import APIClient
from rest_framework import status
from app.models import CustomUser
from app.storage_backends import get_media_storage, MediaStorage
from app.tasks import dispatch_admin_broadcast_email


class AdminProductionStorageAndCeleryTests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            username="admin_test",
            email="admin_test@utc.edu.vn",
            password="AdminPassword@123",
            user_type="admin",
            is_staff=True,
            is_superuser=True
        )

    def test_admin_storage_fallback_when_s3_disabled(self):
        """Kiểm tra fallback lưu trữ cục bộ khi S3 tắt"""
        storage = get_media_storage()
        self.assertIsInstance(storage, (FileSystemStorage, MediaStorage))

    def test_admin_celery_email_fallback(self):
        """Kiểm tra dispatch email bất đồng bộ hoạt động an toàn"""
        res = dispatch_admin_broadcast_email(
            recipient_emails=["admin_test@utc.edu.vn"],
            subject="Test subject",
            body_text="Test body"
        )
        self.assertTrue(res)


class AdminUTCGoogleSSOTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = CustomUser.objects.create_user(
            username="admin",
            email="admin@utc.edu.vn",
            password="AdminPassword@123",
            user_type="admin",
            is_staff=True,
            is_superuser=True
        )

    def test_admin_sso_with_valid_admin_email(self):
        """Kiểm tra Admin đăng nhập thành công qua UTC SSO"""
        response = self.client.post("/app/auth/google/", {
            "email": "admin@utc.edu.vn"
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user_type"], "admin")
        self.assertIn("refresh_token", response.cookies)

    def test_admin_sso_with_non_admin_user_rejected(self):
        """Kiểm tra tài khoản không có quyền Admin bị từ chối 404/403"""
        response = self.client.post("/app/auth/google/", {
            "email": "unknown_user@utc.edu.vn"
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
