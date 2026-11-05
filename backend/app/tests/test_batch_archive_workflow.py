"""
Hồi quy cho luồng "Kết thúc đợt -> Kho lưu trữ" (GĐ1 Admin).

Bảo đảm:
1. Nút "Kết thúc đợt" cập nhật đủ current_stage / is_closed / is_active.
2. Đợt đã kết thúc biến mất khỏi danh sách "Đợt Đang Hoạt Động" và xuất hiện ở kho lưu trữ.
3. API xuất Excel hồ sơ sinh viên nhận đúng batch id từ URL path
   (trước đây view chỉ đọc query string nên xuất nhầm đợt).
4. Mở lại đợt khôi phục trạng thái hoạt động.
"""

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from app.models import AcademicBatch, CustomUser, Student


class BatchArchiveWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = CustomUser.objects.create_user(
            username="admin_archive",
            email="admin_archive@utc.edu.vn",
            password="adminpassword123",
            user_type="admin",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.admin)

        self.batch = AcademicBatch.objects.create(
            batch_code="K62_HK1_2026_2027",
            batch_name="Đợt ĐATN K62 HK1 2026-2027",
            program_type="BOTH",
            current_stage="PHASE_5_IN_PROGRESS",
            is_active=True,
        )

        self.student_user = CustomUser.objects.create_user(
            username="201200021",
            first_name="An",
            last_name="Trần",
            email="an.tran@utc.edu.vn",
            user_type="student",
        )
        self.student = Student.objects.create(
            user=self.student_user,
            registration_no="201200021",
            academic_batch=self.batch,
            education_program="ENGINEER",
        )

    # ------------------------------------------------------------------
    # 1. Kết thúc đợt
    # ------------------------------------------------------------------
    def test_close_batch_sets_all_three_flags(self):
        resp = self.client.post(f"/admin/batches/{self.batch.id}/close/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.batch.refresh_from_db()
        self.assertEqual(self.batch.current_stage, "COMPLETED")
        self.assertTrue(self.batch.is_closed)
        self.assertFalse(self.batch.is_active)

        self.assertTrue(resp.data["is_closed"])
        self.assertFalse(resp.data["is_active"])
        self.assertEqual(resp.data["current_stage"], "COMPLETED")

    def test_closed_batch_disappears_from_active_list(self):
        """Frontend lọc active = !is_closed && is_active && stage != COMPLETED."""
        self.client.post(f"/admin/batches/{self.batch.id}/close/")

        resp = self.client.get("/admin/batches/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        payload = resp.data["results"] if isinstance(resp.data, dict) else resp.data

        active = [
            b for b in payload
            if not b["is_closed"] and b["is_active"] and b["current_stage"] != "COMPLETED"
        ]
        archived = [
            b for b in payload
            if b["is_closed"] or not b["is_active"] or b["current_stage"] == "COMPLETED"
        ]

        self.assertNotIn(self.batch.id, [b["id"] for b in active])
        self.assertIn(self.batch.id, [b["id"] for b in archived])

    def test_close_batch_writes_audit_log(self):
        self.client.post(f"/admin/batches/{self.batch.id}/close/")
        log = self.batch.audit_logs_first() if hasattr(self.batch, "audit_logs_first") else None
        # AuditLog liên kết qua user -> kiểm tra trực tiếp
        from app.models import AuditLog
        self.assertTrue(
            AuditLog.objects.filter(user=self.admin, action_type="group_status_change").exists()
        )

    # ------------------------------------------------------------------
    # 2. Xuất Excel hồ sơ sinh viên của đợt đã lưu trữ (lỗi URL path)
    # ------------------------------------------------------------------
    def test_export_students_uses_batch_id_from_url_path(self):
        """
        Route: /admin/batches/<int:batch_id>/export-students/
        View trước đây chỉ đọc request.query_params['batch_id'] nên rơi về
        batch active khác -> xuất nhầm hồ sơ.
        """
        # Tạo thêm 1 đợt đang hoạt động để bắt lỗi "xuất nhầm đợt"
        other_batch = AcademicBatch.objects.create(
            batch_code="K63_HK1_2027_2028",
            batch_name="Đợt ĐATN K63",
            program_type="BOTH",
            current_stage="PHASE_1_SETUP",
            is_active=True,
        )

        resp = self.client.get(f"/admin/batches/{self.batch.id}/export-students/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(
            resp["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        # Tên file phải chứa mã đợt được yêu cầu, không phải đợt active khác
        self.assertIn(self.batch.batch_code, resp["Content-Disposition"])
        self.assertNotIn(other_batch.batch_code, resp["Content-Disposition"])

    def test_export_students_still_supports_query_string(self):
        resp = self.client.get(f"/admin/students/export-excel/?batch_id={self.batch.id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn(self.batch.batch_code, resp["Content-Disposition"])

    def test_export_students_of_archived_batch_after_close(self):
        """Sau khi kết thúc đợt (is_active=False) vẫn xuất được hồ sơ lưu trữ."""
        self.client.post(f"/admin/batches/{self.batch.id}/close/")

        resp = self.client.get(f"/admin/batches/{self.batch.id}/export-students/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn(self.batch.batch_code, resp["Content-Disposition"])

    # ------------------------------------------------------------------
    # 3. Mở lại đợt
    # ------------------------------------------------------------------
    def test_reopen_batch_restores_active_state(self):
        self.client.post(f"/admin/batches/{self.batch.id}/close/")

        resp = self.client.post(f"/admin/batches/{self.batch.id}/reopen/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.batch.refresh_from_db()
        self.assertFalse(self.batch.is_closed)
        self.assertTrue(self.batch.is_active)
        self.assertNotEqual(self.batch.current_stage, "COMPLETED")
        # Mở lại phải đưa về GĐ6 (xét bảo vệ & hội đồng)
        self.assertEqual(self.batch.current_stage, "PHASE_6_DEFENSE")

    def test_reopen_makes_batch_active_again_in_list(self):
        self.client.post(f"/admin/batches/{self.batch.id}/close/")
        self.client.post(f"/admin/batches/{self.batch.id}/reopen/")

        resp = self.client.get("/admin/batches/")
        payload = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        active = [
            b for b in payload
            if not b["is_closed"] and b["is_active"] and b["current_stage"] != "COMPLETED"
        ]
        self.assertIn(self.batch.id, [b["id"] for b in active])
