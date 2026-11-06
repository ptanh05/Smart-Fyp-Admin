import io
import openpyxl
from docx import Document
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from app.models import (
    CustomUser,
    AcademicBatch,
    CourseClass,
    Student,
    Supervisor,
    SupervisorQuota,
    ProjectTopicArea,
    InternshipInfo,
    GraduationProject,
    DefenseCouncil,
    CouncilMember,
    FinalGradeSummary,
    EvaluationPolicy
)
from app.services.excel_importer import ExcelImportService
from app.services.allocation_engine import MinCostMaxFlowAllocationEngine
from app.services.reviewer_engine import ReviewerAndCouncilAllocationEngine
from app.services.document_generator import DocumentGenerationService

class AdminGraduationSystemTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin = CustomUser.objects.create_user(
            username="admin_utc",
            email="admin@utc.edu.vn",
            password="adminpassword123",
            user_type="admin",
            is_staff=True
        )

        # Batch
        self.batch = AcademicBatch.objects.create(
            batch_code="2026_2027_HK1",
            batch_name="Đợt ĐATN K60-K63",
            is_active=True
        )

        # Topic Area
        self.topic_software = ProjectTopicArea.objects.create(
            name="Phát triển phần mềm và ứng dụng (webApp, MobleApp)",
            code="SOFTWARE_DEV",
            is_active=True
        )

        # Supervisors & Quotas
        self.sup1_user = CustomUser.objects.create_user(
            username="gv_du",
            email="du@utc.edu.vn",
            password="password123",
            first_name="Dư",
            last_name="Nguyễn Đức",
            user_type="supervisor"
        )
        self.sup1 = Supervisor.objects.create(
            user=self.sup1_user,
            supervisor_id="GV003",
            academic_title="TS",
            department_name="CNPM"
        )
        self.quota1 = SupervisorQuota.objects.create(
            supervisor=self.sup1,
            batch=self.batch,
            viet_anh_quota=2,
            general_cntt_quota=5,
            max_total_quota=7
        )

        self.sup2_user = CustomUser.objects.create_user(
            username="gv_sao",
            email="sao@utc.edu.vn",
            password="password123",
            first_name="Sao",
            last_name="Nguyễn Kim",
            user_type="supervisor"
        )
        self.sup2 = Supervisor.objects.create(
            user=self.sup2_user,
            supervisor_id="GV008",
            academic_title="TS",
            department_name="Mạng&HTTT"
        )
        self.quota2 = SupervisorQuota.objects.create(
            supervisor=self.sup2,
            batch=self.batch,
            viet_anh_quota=2,
            general_cntt_quota=4,
            max_total_quota=6
        )

    def test_excel_importer_service(self):
        """Test importing students from Excel roster"""
        wb = openpyxl.Workbook()
        ws = wb.active
        assert ws is not None
        ws.title = "IT1.659.103"

        # Headers
        ws.cell(row=6, column=1, value="Học phần: Đồ án tốt nghiệp Kỹ sư CNTT-1-1-26(N02).DA")
        ws.cell(row=9, column=1, value="STT")
        ws.cell(row=9, column=2, value="Lớp")
        ws.cell(row=9, column=3, value="Mã số SV")
        ws.cell(row=9, column=4, value="Họ đệm")
        ws.cell(row=9, column=5, value="Tên")

        # Row 1
        ws.cell(row=10, column=1, value=1)
        ws.cell(row=10, column=2, value="CNTT1 K62")
        ws.cell(row=10, column=3, value="211200001")
        ws.cell(row=10, column=4, value="Nguyễn Văn")
        ws.cell(row=10, column=5, value="An")

        # Row 2
        ws.cell(row=11, column=1, value=2)
        ws.cell(row=11, column=2, value="CNTT2 K62")
        ws.cell(row=11, column=3, value="211200002")
        ws.cell(row=11, column=4, value="Trần Thị")
        ws.cell(row=11, column=5, value="Bình")

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        res = ExcelImportService.import_students_from_excel(buffer, self.batch.id)
        self.assertTrue(res["success"])
        self.assertEqual(res["total"], 2)
        self.assertEqual(res["created"], 2)

        # Check DB
        student1 = Student.objects.get(registration_no="211200001")
        self.assertEqual(student1.user.first_name, "An")
        self.assertEqual(student1.user.last_name, "Nguyễn Văn")
        self.assertIsNotNone(student1.course_class)
        assert student1.course_class is not None
        self.assertEqual(student1.course_class.class_code, "CNTT1 K62")

    # ------------------------------------------------------------------
    # Regression: Import Excel phải dò được cột MSSV với nhiều định dạng header
    # (bug: import ra 0 dòng mà không báo lỗi rõ ràng)
    # ------------------------------------------------------------------
    def _make_xlsx(self, sheet_name, header_row, headers, rows):
        wb = openpyxl.Workbook()
        ws = wb.active
        assert ws is not None
        ws.title = sheet_name
        for c, h in enumerate(headers, start=1):
            ws.cell(header_row, c, h)
        for i, row in enumerate(rows, start=header_row + 1):
            for c, v in enumerate(row, start=1):
                ws.cell(i, c, v)
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return buf

    def test_excel_import_detects_mssv_column_variants(self):
        """Cột MSSV được nhận diện dù header dùng 'Mã số SV' / 'Sinh viên' / nằm ở dòng bất kỳ."""
        variants = [
            # (sheet, header_row, headers, rows, expected_total)
            ("DS_Sinh_Vien", 1,
             ["STT", "Mã sinh viên (MSSV) *", "Họ đệm *", "Tên *", "Lớp sinh hoạt"],
             [[1, "201200101", "Nguyễn Văn", "An", "CNTT1 K62"],
              [2, "201200102", "Trần Thị", "Bình", "CNTT2 K62"]], 2),
            ("IT1.659.103", 6,
             ["STT", "Mã số SV", "Họ đệm", "Tên"],
             [[1, "211200001", "Nguyễn Văn", "An"],
              [2, "211200002", "Trần Thị", "Bình"]], 2),
            ("Sheet1", 1,
             ["STT", "Sinh viên", "Họ và tên", "Lớp"],
             [[1, "211200003", "Lê Hoàng Cường", "CNTT3 K62"]], 1),
        ]

        for sheet, hrow, headers, rows, expected in variants:
            with self.subTest(sheet=sheet, header_row=hrow):
                batch = AcademicBatch.objects.create(
                    batch_code=f"V{hrow}{len(sheet)}",
                    batch_name=f"Variant {sheet}",
                    is_active=False,
                )
                buf = self._make_xlsx(sheet, hrow, headers, rows)
                res = ExcelImportService.import_students_from_excel(buf, batch.id)

                self.assertTrue(res["success"])
                self.assertEqual(
                    res["total"], expected,
                    f"Sheet '{sheet}' phải import {expected} sinh viên, lỗi: {res['errors']}",
                )
                self.assertEqual(res["created"], expected)
                self.assertEqual(res["skipped"], 0)
                self.assertTrue(
                    Student.objects.filter(academic_batch=batch).count() == expected
                )

    def test_excel_import_falls_back_when_no_header_row(self):
        """File không có dòng tiêu đề vẫn được import nhờ tự suy luận cột MSSV từ dữ liệu."""
        batch = AcademicBatch.objects.create(
            batch_code="NOHDR", batch_name="No Header", is_active=False
        )
        buf = self._make_xlsx(
            "Sheet1", 1,
            [1, "211200004", "Phạm Minh", "Đức", "CNTT1 K62"],
            [[2, "211200005", "Võ Thị", "Hà", "CNTT2 K62"]],
        )
        res = ExcelImportService.import_students_from_excel(buf, batch.id)

        self.assertTrue(res["success"])
        self.assertEqual(res["total"], 2)
        self.assertEqual(res["created"], 2)
        self.assertTrue(Student.objects.filter(registration_no="211200004").exists())
        self.assertTrue(Student.objects.filter(registration_no="211200005").exists())

    def test_excel_import_reports_error_when_no_valid_rows(self):
        """MSSV sai định dạng -> báo lỗi rõ ràng thay vì im lặng báo 0 dòng."""
        batch = AcademicBatch.objects.create(
            batch_code="BADMSSV", batch_name="Bad MSSV", is_active=False
        )
        buf = self._make_xlsx(
            "DS", 1,
            ["STT", "Mã sinh viên", "Họ và tên"],
            [[1, "2012001", "Sai Định Dạng"]],
        )
        res = ExcelImportService.import_students_from_excel(buf, batch.id)

        self.assertEqual(res["total"], 0)
        self.assertEqual(res["created"], 0)
        self.assertGreaterEqual(res["skipped"], 1)
        self.assertTrue(res["errors"], "Phải có thông báo lỗi khi không import được dòng nào")
        self.assertIn(
            "KHÔNG import được dòng dữ liệu nào",
            " ".join(res["errors"]),
            "Phải có cảnh báo tổng quát khi import 0 dòng",
        )

    def test_generate_sample_roster_is_importable(self):
        """File danh sách sinh viên mẫu (download từ mục Download) phải import được 100%."""
        buf = ExcelImportService.generate_sample_roster()
        self.assertIsNotNone(buf)

        batch = AcademicBatch.objects.create(
            batch_code="SAMPLE_ROSTER", batch_name="Sample Roster", is_active=False
        )
        buf.seek(0)
        res = ExcelImportService.import_students_from_excel(buf, batch.id)

        self.assertTrue(res["success"])
        self.assertEqual(res["total"], 216, f"Lỗi: {res['errors'][:5]}")
        self.assertEqual(res["created"], 216)
        self.assertEqual(res["skipped"], 0)
        self.assertEqual(len(res["errors"]), 0)
        self.assertEqual(
            Student.objects.filter(academic_batch=batch).count(), 216
        )
        # MSSV phải đúng 9 chữ số và không trùng dữ liệu đang có
        mssvs = list(
            Student.objects.filter(academic_batch=batch).values_list(
                "registration_no", flat=True
            )
        )
        self.assertTrue(all(len(m) == 9 and m.isdigit() for m in mssvs))
        self.assertEqual(len(set(mssvs)), 216, "MSSV trong file mẫu phải là duy nhất")

    def test_download_sample_roster_endpoint(self):
        """API GET /admin/students/sample-roster/ trả về file .xlsx hợp lệ."""
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/admin/students/sample-roster/")

        self.assertEqual(res.status_code, 200)
        self.assertIn("attachment", res["Content-Disposition"])
        self.assertIn(".xlsx", res["Content-Disposition"])
        self.assertGreater(len(res.content), 1000)

        # Nội dung phải là file Excel đọc được
        import openpyxl as _oxl
        wb = _oxl.load_workbook(io.BytesIO(res.content))
        self.assertIn("Danh_Sach_Sinh_Vien", wb.sheetnames)
        self.assertGreaterEqual(len(wb.sheetnames), 5)

    def test_mcmf_supervisor_allocation_engine(self):
        """Test Min-Cost Max-Flow matching engine"""
        # Create 2 students
        u1 = CustomUser.objects.create_user(username="21120001", user_type="student")
        s1 = Student.objects.create(user=u1, registration_no="21120001", academic_batch=self.batch)
        InternshipInfo.objects.create(
            student=s1,
            batch=self.batch,
            preferred_supervisor=self.sup1,
            topic_direction=self.topic_software
        )

        u2 = CustomUser.objects.create_user(username="21120002", user_type="student")
        s2 = Student.objects.create(user=u2, registration_no="21120002", academic_batch=self.batch)
        InternshipInfo.objects.create(
            student=s2,
            batch=self.batch,
            preferred_supervisor=self.sup2,
            topic_direction=self.topic_software
        )

        res = MinCostMaxFlowAllocationEngine.allocate_supervisors_for_batch(self.batch.id)
        self.assertTrue(res["success"])
        self.assertEqual(res["matched_count"], 2)
        self.assertEqual(res["unassigned_count"], 0)

        # Verify DB projects
        p1 = GraduationProject.objects.get(student=s1)
        self.assertEqual(p1.supervisor, self.sup1)
        p2 = GraduationProject.objects.get(student=s2)
        self.assertEqual(p2.supervisor, self.sup2)

    def test_reviewer_and_council_allocation_no_conflict(self):
        """Test Reviewer Allocation with strict no-conflict constraint"""
        u1 = CustomUser.objects.create_user(username="21120001", user_type="student")
        s1 = Student.objects.create(user=u1, registration_no="21120001", academic_batch=self.batch)
        p1 = GraduationProject.objects.create(
            student=s1,
            supervisor=self.sup1,  # Sup1 is GVHD
            batch=self.batch,
            topic_title_vi="ĐATN 1"
        )

        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=1,
            council_name="Hội đồng 1"
        )
        CouncilMember.objects.create(council=council, supervisor=self.sup2, user=self.sup2_user, role="CHAIR")

        res = ReviewerAndCouncilAllocationEngine.assign_councils_and_reviewers(self.batch.id)
        self.assertTrue(res["success"])
        self.assertEqual(res["assigned_count"], 1)

        p1.refresh_from_db()
        self.assertEqual(p1.council, council)
        self.assertEqual(p1.reviewer, self.sup2)  # Reviewer must be Sup2 (not Sup1)
        self.assertNotEqual(p1.reviewer, p1.supervisor)

    def test_document_generation_word_and_excel(self):
        """Test generating official Word Tờ trình and Excel Bảng điểm"""
        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=1,
            council_name="Hội đồng 1 - Kỹ sư CNTT"
        )
        CouncilMember.objects.create(council=council, supervisor=self.sup1, user=self.sup1_user, role="CHAIR")
        CouncilMember.objects.create(council=council, supervisor=self.sup2, user=self.sup2_user, role="SECRETARY")

        # Word Docx Test
        docx_buffer = DocumentGenerationService.generate_to_trinh_docx(council.id)
        self.assertGreater(len(docx_buffer.getvalue()), 1000)
        doc = Document(docx_buffer)
        text_content = " ".join([p.text for p in doc.paragraphs])
        self.assertIn("TỜ TRÌNH", text_content)
        self.assertIn("Hội đồng 1 - Kỹ sư CNTT", text_content)

        # Excel Xlsx Test
        excel_buffer = DocumentGenerationService.generate_bien_ban_excel(council.id)
        self.assertGreater(len(excel_buffer.getvalue()), 1000)
        wb = openpyxl.load_workbook(excel_buffer)
        self.assertIn("Hội đồng 1", wb.sheetnames)
