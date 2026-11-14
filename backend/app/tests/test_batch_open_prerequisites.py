from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from app.models import AcademicBatch, CustomUser, Student, Supervisor, SupervisorQuota


class BatchOpenPrerequisiteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = CustomUser.objects.create_user(
            username="admin_open_batch",
            password="password123",
            user_type="admin",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.admin)
        self.batch = AcademicBatch.objects.create(
            batch_code="OPEN_RULES_2026",
            batch_name="Open Rules",
            current_stage="PHASE_1_SETUP",
        )

    def add_student(self):
        user = CustomUser.objects.create_user(
            username="201200099",
            password="password123",
            user_type="student",
        )
        return Student.objects.create(
            user=user,
            registration_no="201200099",
            academic_batch=self.batch,
        )

    def add_supervisor(self):
        user = CustomUser.objects.create_user(
            username="lecturer_open_batch",
            password="password123",
            user_type="supervisor",
        )
        return Supervisor.objects.create(user=user, supervisor_id="GV-OPEN-01")

    def test_cannot_open_batch_without_students(self):
        response = self.client.post(f"/admin/batches/{self.batch.id}/open/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("chưa có sinh viên", response.data["detail"])

    def test_cannot_open_batch_without_selected_supervisors(self):
        self.add_student()
        response = self.client.post(f"/admin/batches/{self.batch.id}/open/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("chưa chọn giảng viên", response.data["detail"])

    def test_select_supervisor_then_open_batch(self):
        self.add_student()
        supervisor = self.add_supervisor()

        select_response = self.client.post(
            "/admin/quotas/",
            {"batch_id": self.batch.id, "supervisor_ids": [supervisor.id]},
            format="json",
        )
        self.assertEqual(select_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            SupervisorQuota.objects.filter(batch=self.batch, supervisor=supervisor).exists()
        )

        open_response = self.client.post(f"/admin/batches/{self.batch.id}/open/")
        self.assertEqual(open_response.status_code, status.HTTP_200_OK)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.current_stage, "PHASE_2_ALLOCATING")

    def test_quota_get_does_not_auto_add_all_supervisors(self):
        self.add_supervisor()
        response = self.client.get(f"/admin/quotas/?batch_id={self.batch.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])
        self.assertFalse(SupervisorQuota.objects.filter(batch=self.batch).exists())
