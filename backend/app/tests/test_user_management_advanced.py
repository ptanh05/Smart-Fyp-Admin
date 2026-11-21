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

    def test_excel_import_rejects_student_already_in_another_batch(self):
        user = CustomUser.objects.create_user(
            username="201200777",
            email="201200777@sv.utc.edu.vn",
            user_type="student",
        )
        student = Student.objects.create(
            user=user,
            registration_no="201200777",
            academic_batch=self.batch,
            course_class=self.class_dt,
        )
        other_batch = AcademicBatch.objects.create(
            batch_code="K63_HK1_2027",
            batch_name="Đợt khác",
        )

        wb = openpyxl.Workbook()
        ws = wb.active
        assert ws is not None
        ws.title = "CNTT_1_K62"
        ws.append(["STT", "Mã sinh viên", "Họ và tên", "Lớp"])
        ws.append([1, "201200777", "Phạm Văn Hải", "CNTT 1 - K62"])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        buf.name = "duplicate_batch.xlsx"

        res = self.client.post(
            reverse("admin-users-import-excel"),
            {"file": buf, "batch_id": other_batch.id},
            format="multipart",
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.data["success"])
        self.assertEqual(res.data["conflict_type"], "STUDENT_ALREADY_IN_ANOTHER_BATCH")
        self.assertEqual(res.data["conflict_count"], 1)
        self.assertEqual(res.data["conflicts"][0]["registration_no"], "201200777")
        student.refresh_from_db()
        self.assertEqual(student.academic_batch, self.batch)
        self.assertFalse(CourseClass.objects.filter(batch=other_batch).exists())

    def test_excel_import_filters_students_by_batch_education_program(self):
        def build_program_file(rows, filename="programs.xlsx"):
            wb = openpyxl.Workbook()
            ws = wb.active
            assert ws is not None
            ws.title = "DS_Sinh_Vien"
            ws.append(["STT", "Mã sinh viên", "Họ và tên", "Lớp sinh hoạt", "Hệ đào tạo"])
            for idx, (mssv, name, cls_name, edu_label) in enumerate(rows, start=1):
                ws.append([idx, mssv, name, cls_name, edu_label])
            buf = io.BytesIO()
            wb.save(buf)
            buf.seek(0)
            buf.name = filename
            return buf

        bachelor_batch = AcademicBatch.objects.create(
            batch_code="BACHELOR_ONLY",
            batch_name="Đợt Cử nhân",
            program_type="BACHELOR",
        )
        # Mixed file containing Kỹ sư (spelled "Kĩ sư") must be rejected completely
        bachelor_reject = self.client.post(
            reverse("admin-users-import-excel"),
            {
                "file": build_program_file([
                    ("211100001", "Nguyễn Văn Cử Nhân", "CNTT1 - K62", "Cử nhân"),
                    ("211100002", "Trần Văn Kỹ Sư", "CNTT Kỹ sư 1 - K62", "Kĩ sư"),
                ]),
                "batch_id": bachelor_batch.id,
            },
            format="multipart",
        )
        self.assertEqual(bachelor_reject.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(bachelor_reject.data["success"])
        self.assertEqual(bachelor_reject.data["conflict_type"], "EDUCATION_PROGRAM_MISMATCH")
        self.assertFalse(Student.objects.filter(academic_batch=bachelor_batch).exists())
        self.assertFalse(CourseClass.objects.filter(batch=bachelor_batch).exists())

        # Pure Cử nhân file succeeds
        bachelor_ok = self.client.post(
            reverse("admin-users-import-excel"),
            {
                "file": build_program_file([
                    ("211100001", "Nguyễn Văn Cử Nhân", "CNTT1 - K62", "Cử nhân"),
                ]),
                "batch_id": bachelor_batch.id,
            },
            format="multipart",
        )
        self.assertEqual(bachelor_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(bachelor_ok.data["created"], 1)
        self.assertTrue(Student.objects.filter(registration_no="211100001", education_program="BACHELOR").exists())

        engineer_batch = AcademicBatch.objects.create(
            batch_code="ENGINEER_ONLY",
            batch_name="Đợt Kỹ sư",
            program_type="ENGINEER",
        )
        # Mixed file containing Cử nhân must be rejected completely
        engineer_reject = self.client.post(
            reverse("admin-users-import-excel"),
            {
                "file": build_program_file([
                    ("221100001", "Nguyễn Văn Cử Nhân", "CNTT1 - K62", "Cử nhân"),
                    ("221100002", "Trần Văn Kỹ Sư", "CNTT Kỹ sư 1 - K62", "Kĩ sư"),
                ]),
                "batch_id": engineer_batch.id,
            },
            format="multipart",
        )
        self.assertEqual(engineer_reject.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(engineer_reject.data["success"])
        self.assertEqual(engineer_reject.data["conflict_type"], "EDUCATION_PROGRAM_MISMATCH")
        self.assertFalse(Student.objects.filter(academic_batch=engineer_batch).exists())
        self.assertFalse(CourseClass.objects.filter(batch=engineer_batch).exists())

        # Pure Kỹ sư file succeeds
        engineer_ok = self.client.post(
            reverse("admin-users-import-excel"),
            {
                "file": build_program_file([
                    ("221100002", "Trần Văn Kỹ Sư", "CNTT Kỹ sư 1 - K62", "Kĩ sư"),
                ]),
                "batch_id": engineer_batch.id,
            },
            format="multipart",
        )
        self.assertEqual(engineer_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(engineer_ok.data["created"], 1)
        self.assertTrue(Student.objects.filter(registration_no="221100002", education_program="ENGINEER").exists())

        both_batch = AcademicBatch.objects.create(
            batch_code="BOTH_PROGRAMS",
            batch_name="Đợt Cả hai",
            program_type="BOTH",
        )
        both_response = self.client.post(
            reverse("admin-users-import-excel"),
            {
                "file": build_program_file([
                    ("231100001", "Nguyễn Văn Cử Nhân", "CNTT1 - K62", "Cử nhân"),
                    ("231100002", "Trần Văn Kỹ Sư", "CNTT Kỹ sư 1 - K62", "Kĩ sư"),
                ]),
                "batch_id": both_batch.id,
            },
            format="multipart",
        )
        self.assertEqual(both_response.status_code, status.HTTP_200_OK)
        self.assertEqual(both_response.data["created"], 2)
        self.assertEqual(both_response.data["skipped"], 0)
        self.assertTrue(Student.objects.filter(registration_no="231100001", education_program="BACHELOR").exists())
        self.assertTrue(Student.objects.filter(registration_no="231100002", education_program="ENGINEER").exists())

    def test_excel_import_generic_sheet_does_not_create_unused_course_class(self):
        """
        Verify that importing an Excel file with a generic sheet name like 'Danh_Sach_Sinh_Vien'
        does NOT create an extra empty CourseClass for the sheet when student classes are specified.
        """
        test_batch = AcademicBatch.objects.create(
            batch_code="BATCH_CLEAN_SHEET",
            batch_name="Đợt Test Clean Sheet",
            program_type="BACHELOR"
        )

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Danh_Sach_Sinh_Vien"
        ws.append(["Mã sinh viên", "Họ và tên", "Lớp", "Hệ đào tạo"])
        ws.append(["201200111", "Sinh Viên Một", "CNTT1 - K62", "Cử nhân"])
        ws.append(["201200112", "Sinh Viên Hai", "CNTT2 - K62", "Cử nhân"])

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        response = self.client.post(
            reverse("admin-users-import-excel"),
            {"file": buf, "batch_id": test_batch.id},
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

        # 'Danh_Sach_Sinh_Vien' class should NOT exist
        self.assertFalse(CourseClass.objects.filter(batch=test_batch, class_code="Danh_Sach_Sinh_Vien").exists())

        # The actual classes should exist with students
        self.assertTrue(CourseClass.objects.filter(batch=test_batch, class_code="CNTT1 - K62").exists())
        self.assertTrue(CourseClass.objects.filter(batch=test_batch, class_code="CNTT2 - K62").exists())

        # When querying batches API, only 2 classes are returned
        batches_res = self.client.get(reverse("admin-batches-list") + "?_t=1")
        self.assertEqual(batches_res.status_code, status.HTTP_200_OK)
        found_batch = next(b for b in batches_res.data if b["id"] == test_batch.id)
        self.assertEqual(len(found_batch["classes"]), 2)
        class_codes = [c["class_code"] for c in found_batch["classes"]]
        self.assertNotIn("Danh_Sach_Sinh_Vien", class_codes)

    def test_delete_empty_course_class_api(self):
        """
        Verify that admin can delete an empty course class, but cannot delete a class with students.
        """
        empty_class = CourseClass.objects.create(
            batch=self.batch,
            class_code="EMPTY_CLASS_TEST",
            class_name="Lớp trống cần xóa",
            program_type="DAI_TRA"
        )

        # Successfully delete empty class
        del_res = self.client.delete(reverse("admin-classes-detail", kwargs={"pk": empty_class.id}))
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CourseClass.objects.filter(id=empty_class.id).exists())

        # Cannot delete class with students
        Student.objects.create(
            user=CustomUser.objects.create_user(username="201209999", password="pw"),
            registration_no="201209999",
            course_class=self.class_dt,
            academic_batch=self.batch
        )
        del_non_empty = self.client.delete(reverse("admin-classes-detail", kwargs={"pk": self.class_dt.id}))
        self.assertEqual(del_non_empty.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(CourseClass.objects.filter(id=self.class_dt.id).exists())

    def test_department_normalization_helper(self):
        """
        Verify that normalize_department_name correctly formats unaccented department strings.
        """
        from app.utils.department_formatter import normalize_department_name
        self.assertEqual(normalize_department_name("Bo mon Cong nghe phan mem"), "Bộ môn Công nghệ phần mềm")
        self.assertEqual(normalize_department_name("Bo mon He thong thong tin"), "Bộ môn Hệ thống thông tin")
        self.assertEqual(normalize_department_name("Bo mon Khoa hoc may tinh va Mang may tinh"), "Bộ môn Khoa học máy tính & Mạng máy tính")
        self.assertEqual(normalize_department_name("Bộ môn Mạng máy tính & ATTT"), "Bộ môn Mạng máy tính & ATTT")
        self.assertEqual(normalize_department_name(None, "CNPM"), "Bộ môn Công nghệ phần mềm")
        self.assertEqual(normalize_department_name("", "MMT"), "Bộ môn Mạng máy tính & ATTT")

    def test_supervisor_serializer_normalizes_department_accent(self):
        """
        Verify that supervisor API returns normalized accented department name even if stored unaccented.
        """
        from app.models import Department
        dept = Department.objects.create(code="CNPM", name="Bo mon Cong nghe phan mem")
        sup_user = CustomUser.objects.create_user(username="gv_test_accent", first_name="Hoa", last_name="Nguyen Thi", user_type="supervisor")
        spv = Supervisor.objects.create(
            user=sup_user,
            supervisor_id="UTC099",
            department_name="Bo mon Cong nghe phan mem",
            department_obj=dept
        )

        res = self.client.get(reverse("admin-users-list") + "?user_type=supervisor&search=UTC099")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        users = res.data["users"]
        self.assertEqual(len(users), 1)
        self.assertEqual(users[0]["supervisor_profile"]["department_name"], "Bộ môn Công nghệ phần mềm")
