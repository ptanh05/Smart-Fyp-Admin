import io
import openpyxl
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase
from rest_framework import status
from app.models import CustomUser, Student, Supervisor, SupervisorQuota, AcademicBatch, CourseClass

class AdvancedUserManagementTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = CustomUser.objects.create_user(
            username="test_admin_root",
            email="admin_root@utc.edu.vn",
            password="AdminPassword@123",
            user_type="admin",
            is_staff=True
        )
        self.client.force_authenticate(user=self.admin_user)

        self.batch = AcademicBatch.objects.create(
            batch_code="K62_HK1_2026",
            batch_name="Khóa K62 - Học kỳ 1 (2026-2027)",
            is_active=True
        )

        self.class_va = CourseClass.objects.create(
            batch=self.batch,
            class_code="CNTT_VA_K62",
            class_name="Lớp CNTT Việt - Anh K62",
            program_type="VIET_ANH"
        )

        self.class_dt = CourseClass.objects.create(
            batch=self.batch,
            class_code="CNTT1_K62",
            class_name="Lớp CNTT 1 K62",
            program_type="DAI_TRA"
        )

        self.class_khmt = CourseClass.objects.create(
            batch=self.batch,
            class_code="KHMT1_K62",
            class_name="Lớp KHMT 1 K62",
            program_type="KHMT"
        )

    def test_create_student_with_mssv_password_strategy(self):
        url = reverse("admin-users-list")
        payload = {
            "username": "201200999",
            "first_name": "Minh",
            "last_name": "Nguyễn Hoàng",
            "email": "201200999@lms.utc.edu.vn",
            "user_type": "student",
            "major": "CNTT",
            "program_type": "VIET_ANH",
            "course_class_id": self.class_va.id,
            "academic_batch_id": self.batch.id,
            "password_strategy": "MSSV"
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["plain_password"], "201200999")

        # Verify created in DB
        user = CustomUser.objects.get(username="201200999")
        self.assertTrue(user.check_password("201200999"))
        self.assertEqual(user.user_type, "student")

        std = Student.objects.get(user=user)
        self.assertEqual(std.registration_no, "201200999")
        self.assertEqual(std.course_class, self.class_va)
        self.assertEqual(std.academic_batch, self.batch)

    def test_create_supervisor_with_quota(self):
        url = reverse("admin-users-list")
        payload = {
            "username": "gv_tranduc",
            "first_name": "Đức",
            "last_name": "Trần",
            "email": "tranduc@utc.edu.vn",
            "user_type": "supervisor",
            "supervisor_id": "GV_TD01",
            "academic_title": "TS.",
            "department_name": "Bộ môn Hệ thống thông tin",
            "max_total_quota": 6,
            "viet_anh_quota": 2,
            "general_cntt_quota": 4,
            "password_strategy": "CUSTOM",
            "custom_password": "LecturerPass@2026"
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        user = CustomUser.objects.get(username="gv_tranduc")
        self.assertTrue(user.check_password("LecturerPass@2026"))
        self.assertEqual(user.user_type, "supervisor")

        spv = Supervisor.objects.get(user=user)
        self.assertEqual(spv.academic_title, "TS.")
        self.assertEqual(spv.supervisor_id, "GV_TD01")

        quota = SupervisorQuota.objects.get(supervisor=spv, batch=self.batch)
        self.assertEqual(quota.max_total_quota, 6)
        self.assertEqual(quota.viet_anh_quota, 2)

    def test_get_users_with_counts_and_major_filters(self):
        # Create 1 CNTT student and 1 KHMT student
        u1 = CustomUser.objects.create_user(username="201200111", email="201200111@utc.edu.vn", user_type="student")
        Student.objects.create(user=u1, registration_no="201200111", course_class=self.class_dt, academic_batch=self.batch)

        u2 = CustomUser.objects.create_user(username="201200222", email="201200222@utc.edu.vn", user_type="student")
        Student.objects.create(user=u2, registration_no="201200222", course_class=self.class_khmt, academic_batch=self.batch)

        url = reverse("admin-users-list")
        res = self.client.get(url, {"user_type": "student", "major": "KHMT"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total"], 1)
        self.assertEqual(res.data["users"][0]["username"], "201200222")

        res_all = self.client.get(url, {"user_type": "student"})
        self.assertEqual(res_all.status_code, status.HTTP_200_OK)
        self.assertEqual(res_all.data["total"], 2)
        self.assertEqual(res_all.data["counts"]["khmt_students"], 1)
        self.assertEqual(res_all.data["counts"]["cntt_students"], 1)

    def test_reset_user_password(self):
        user = CustomUser.objects.create_user(username="201200333", email="201200333@utc.edu.vn", user_type="student")
        Student.objects.create(user=user, registration_no="201200333", course_class=self.class_dt, academic_batch=self.batch)

        url = reverse("admin-users-reset-password", kwargs={"pk": user.id})
        res = self.client.post(url, {"password_strategy": "MSSV"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["new_password"], "201200333")

        user.refresh_from_db()
        self.assertTrue(user.check_password("201200333"))

    def test_download_template_and_export_excel(self):
        # Template
        template_url = reverse("admin-users-template")
        res_tpl = self.client.get(template_url)
        self.assertEqual(res_tpl.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheetml", res_tpl.get("Content-Type", ""))

        # Export
        export_url = reverse("admin-users-export")
        res_exp = self.client.get(export_url, {"user_type": "student"})
        self.assertEqual(res_exp.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheetml", res_exp.get("Content-Type", ""))

    def test_excel_import_with_password_strategy(self):
        # Create in-memory excel file
        wb = openpyxl.Workbook()
        ws = wb.active
        assert ws is not None
        ws.title = "CNTT_1_K62"

        ws.append(["Học phần: Đồ án tốt nghiệp CNTT (N01)"])
        ws.append([])
        ws.append(["STT", "Mã sinh viên", "Họ đệm", "Tên", "Lớp"])
        ws.append([1, "201200777", "Phạm Văn", "Hải", "CNTT 1 - K62"])
        ws.append([2, "201200888", "Lê Thị", "Mai", "CNTT 1 - K62"])

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        buf.name = "import_test.xlsx"

        url = reverse("admin-users-import-excel")
        res = self.client.post(
            url,
            {
                "file": buf,
                "batch_id": self.batch.id,
                "password_strategy": "MSSV",
                "default_major": "CNTT"
            },
            format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["created"], 2)
        self.assertEqual(len(res.data["created_accounts"]), 2)
        self.assertEqual(res.data["created_accounts"][0]["plain_password"], "201200777")
