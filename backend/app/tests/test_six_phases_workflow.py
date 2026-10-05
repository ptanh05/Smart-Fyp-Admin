import io
import openpyxl
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

from app.models import (
    CustomUser,
    AcademicBatch,
    Department,
    Supervisor,
    SupervisorQuota,
    Student,
    StudentPreference,
    GraduationProject,
    DefenseCouncil,
    CouncilMember,
    DefenseScheduleSlot,
    WeeklyProgressReport,
    EvaluationPolicy,
    AuditLog
)

class SixPhasesWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin User
        self.admin = CustomUser.objects.create_user(
            username="admin_workflow",
            email="admin_wf@utc.edu.vn",
            password="adminpassword123",
            user_type="admin",
            is_staff=True
        )
        self.client.force_authenticate(user=self.admin)

        # Phase 1: Tạo Bộ môn & Đợt đồ án
        self.dept_cnpm = Department.objects.create(name="Bộ môn Công nghệ phần mềm", code="CNPM")
        self.dept_httt = Department.objects.create(name="Bộ môn Hệ thống thông tin", code="HTTT")

        self.batch = AcademicBatch.objects.create(
            batch_code="2026_K62_KS",
            batch_name="Đợt ĐATN K62 Kỹ sư & Cử nhân",
            program_type="BOTH",
            current_stage="PHASE_1_SETUP",
            is_active=True
        )

        # Giảng viên 1: TS (Học vị đủ cho Kỹ sư)
        self.sup1_user = CustomUser.objects.create_user(
            username="gv_ts_tuan",
            first_name="Tuấn",
            last_name="Nguyễn Văn",
            email="tuan@utc.edu.vn",
            user_type="supervisor"
        )
        self.sup1 = Supervisor.objects.create(
            user=self.sup1_user,
            supervisor_id="GV_TS_01",
            academic_title="TS",
            academic_rank_multiplier=1.2,
            department_obj=self.dept_cnpm,
            department_name="CNPM"
        )
        self.quota1 = SupervisorQuota.objects.create(
            supervisor=self.sup1,
            batch=self.batch,
            base_quota=5,
            rank_multiplier=1.2,
            max_total_quota=6
        )

        # Giảng viên 2: ThS (Chỉ hướng dẫn Cử nhân, không đủ chuẩn Kỹ sư)
        self.sup2_user = CustomUser.objects.create_user(
            username="gv_ths_minh",
            first_name="Minh",
            last_name="Trần Văn",
            email="minh@utc.edu.vn",
            user_type="supervisor"
        )
        self.sup2 = Supervisor.objects.create(
            user=self.sup2_user,
            supervisor_id="GV_THS_02",
            academic_title="ThS",
            academic_rank_multiplier=1.0,
            department_obj=self.dept_httt,
            department_name="HTTT"
        )
        self.quota2 = SupervisorQuota.objects.create(
            supervisor=self.sup2,
            batch=self.batch,
            base_quota=5,
            rank_multiplier=1.0,
            max_total_quota=5
        )

        # Sinh viên 1: Kỹ sư
        self.sv1_user = CustomUser.objects.create_user(
            username="201200001",
            first_name="An",
            last_name="Trần",
            user_type="student",
            email="sv1@utc.edu.vn"
        )
        self.sv1 = Student.objects.create(
            user=self.sv1_user,
            registration_no="201200001",
            academic_batch=self.batch,
            education_program="ENGINEER"
        )

        # Sinh viên 2: Cử nhân
        self.sv2_user = CustomUser.objects.create_user(
            username="201200002",
            first_name="Bình",
            last_name="Lê",
            user_type="student",
            email="sv2@utc.edu.vn"
        )
        self.sv2 = Student.objects.create(
            user=self.sv2_user,
            registration_no="201200002",
            academic_batch=self.batch,
            education_program="BACHELOR"
        )

    def test_phase_1_supervisor_profile_and_multiplier_update(self):
        """Phase 1: Cập nhật học vị, hệ số quota và bộ môn cho GV"""
        url = f"/admin/supervisors/{self.sup1.id}/profile/"
        resp = self.client.patch(url, {
            "academic_title": "PGS.TS",
            "academic_rank_multiplier": 1.5,
            "department_id": self.dept_cnpm.id,
            "research_interest": "AI, Trí tuệ nhân tạo, Big Data"
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.sup1.refresh_from_db()
        self.assertEqual(self.sup1.academic_title, "PGS.TS")
        self.assertEqual(self.sup1.academic_rank_multiplier, 1.5)
        self.assertEqual(self.sup1.department_obj, self.dept_cnpm)

        self.quota1.refresh_from_db()
        self.assertEqual(self.quota1.rank_multiplier, 1.5)
        # base_quota (5) * 1.5 = 8 (rounded)
        self.assertEqual(self.quota1.max_total_quota, 8)

    def test_phase_2_allocation_with_engineer_hard_constraint(self):
        """Phase 2: Ràng buộc Kỹ sư -> ThS không được nhận SV Kỹ sư"""
        StudentPreference.objects.create(
            student=self.sv1,
            batch=self.batch,
            preference_1=self.sup2, # SV Kỹ sư chọn GV ThS
            preference_2=self.sup1, # NV2 là GV TS
            sub_criteria="Mong muốn theo hướng phần mềm"
        )
        StudentPreference.objects.create(
            student=self.sv2,
            batch=self.batch,
            preference_1=self.sup2 # SV Cử nhân chọn GV ThS
        )

        alloc_resp = self.client.post("/admin/allocations/auto-match/", {
            "batch_id": self.batch.id
        }, format="json")
        self.assertEqual(alloc_resp.status_code, status.HTTP_200_OK)

        # SV1 (Kỹ sư) không được gán cho ThS (sup2), mà phải sang TS (sup1)
        p1 = GraduationProject.objects.get(student=self.sv1)
        self.assertEqual(p1.supervisor, self.sup1)

        # SV2 (Cử nhân) hợp lệ với ThS (sup2)
        p2 = GraduationProject.objects.get(student=self.sv2)
        self.assertEqual(p2.supervisor, self.sup2)

        # Khoa chốt phân công
        finalize_resp = self.client.post("/admin/allocations/finalize/", {
            "batch_id": self.batch.id
        }, format="json")
        self.assertEqual(finalize_resp.status_code, status.HTTP_200_OK)

        # Công bố & gửi thông báo
        pub_resp = self.client.post("/admin/allocations/publish/", {
            "batch_id": self.batch.id
        }, format="json")
        self.assertEqual(pub_resp.status_code, status.HTTP_200_OK)
        self.batch.refresh_from_db()
        self.assertTrue(self.batch.is_allocation_published)
        self.assertEqual(self.batch.current_stage, "PHASE_3_TOPIC")

    def test_phase_3_topic_review_and_outline_generation(self):
        """Phase 3: Khoa duyệt đề tài hoặc yêu cầu sửa; Sinh file đề cương .docx"""
        proj = GraduationProject.objects.create(
            student=self.sv1,
            batch=self.batch,
            supervisor=self.sup1,
            topic_title_vi="Hệ thống Quản lý Đồ án Tốt nghiệp",
            topic_title_en="Graduation Project Management System",
            topic_review_status="SUBMITTED"
        )

        # Khoa yêu cầu sửa đề tài (quay lại Draft)
        rev_resp = self.client.patch(f"/admin/projects/{proj.id}/topic-approval/", {
            "decision": "REQUEST_REVISION",
            "notes": "Cần bổ sung chi tiết kiến trúc microservices và sơ đồ C4"
        }, format="json")
        self.assertEqual(rev_resp.status_code, status.HTTP_200_OK)
        proj.refresh_from_db()
        self.assertEqual(proj.topic_review_status, "REVISION_REQUIRED")

        # Sau khi sửa, Khoa Approve
        app_resp = self.client.patch(f"/admin/projects/{proj.id}/topic-approval/", {
            "decision": "APPROVE"
        }, format="json")
        self.assertEqual(app_resp.status_code, status.HTTP_200_OK)
        proj.refresh_from_db()
        self.assertEqual(proj.topic_review_status, "APPROVED")

        # Tải file đề cương .docx
        doc_resp = self.client.get(f"/admin/projects/{proj.id}/download-outline/")
        self.assertEqual(doc_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(doc_resp["Content-Type"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        self.assertGreater(len(doc_resp.content), 500)

    def test_phase_4_eligibility_and_force_approve_disqualify(self):
        """Phase 4: Xét điều kiện làm đồ án, Force Approve và Loại khỏi đợt"""
        proj1 = GraduationProject.objects.create(
            student=self.sv1, batch=self.batch, supervisor=self.sup1,
            initial_eligibility="INELIGIBLE", ineligibility_reason="Nợ 12 tín chỉ"
        )
        proj2 = GraduationProject.objects.create(
            student=self.sv2, batch=self.batch, supervisor=self.sup2,
            initial_eligibility="INELIGIBLE", ineligibility_reason="GPA 1.7"
        )

        # SV1 được Khoa Force Approve (đặc cách làm đồ án)
        f_resp = self.client.patch(f"/admin/projects/{proj1.id}/eligibility-decision/", {
            "decision": "FORCE_APPROVE",
            "reason": "Hội đồng Khoa đồng ý cho nợ và hoàn thành trả nợ trước bảo vệ"
        }, format="json")
        self.assertEqual(f_resp.status_code, status.HTTP_200_OK)
        proj1.refresh_from_db()
        self.assertEqual(proj1.initial_eligibility, "FORCE_APPROVED")
        self.assertEqual(proj1.status, "IN_PROGRESS")

        # SV2 bị loại khỏi đợt
        d_resp = self.client.patch(f"/admin/projects/{proj2.id}/eligibility-decision/", {
            "decision": "DISQUALIFY",
            "reason": "Không đạt chuẩn GPA tối thiểu theo quy chế đào tạo"
        }, format="json")
        self.assertEqual(d_resp.status_code, status.HTTP_200_OK)
        proj2.refresh_from_db()
        self.assertEqual(proj2.initial_eligibility, "DISQUALIFIED")
        self.assertEqual(proj2.status, "DISQUALIFIED")

    def test_phase_6_deferral_decision_and_auto_scheduling_flow(self):
        """Phase 6: Xét học vụ, Nhánh bảo lưu, Xếp lịch tự động 1CT-2TK-2UV, Kết thúc đợt"""
        # Tạo thêm GV để đủ hội đồng 5 người (1CT - 2TK - 2UV)
        extra_users = []
        extra_sups = []
        for i in range(3, 7):
            u = CustomUser.objects.create_user(username=f"gv_hd_{i}", first_name=f"GV{i}", last_name="Hội đồng")
            s = Supervisor.objects.create(user=u, supervisor_id=f"GV_{i}", academic_title="TS")
            extra_users.append(u)
            extra_sups.append(s)

        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=1,
            council_name="Hội đồng Chấm ĐATN 01",
            defense_room="502-A9",
            session_date="2026-06-20",
            session_time="CA1"
        )
        CouncilMember.objects.create(council=council, supervisor=self.sup1, user=self.sup1_user, role="CHAIR")
        CouncilMember.objects.create(council=council, supervisor=self.sup2, user=self.sup2_user, role="SECRETARY")
        CouncilMember.objects.create(council=council, supervisor=extra_sups[0], user=extra_users[0], role="SECRETARY")
        CouncilMember.objects.create(council=council, supervisor=extra_sups[1], user=extra_users[1], role="MEMBER")
        CouncilMember.objects.create(council=council, supervisor=extra_sups[2], user=extra_users[2], role="MEMBER")

        proj_pass = GraduationProject.objects.create(
            student=self.sv1, batch=self.batch, supervisor=self.sup1,
            topic_title_vi="Đồ án Đạt Chuẩn", supervisor_defense_confirmed=True,
            final_academic_eligibility="ELIGIBLE", is_eligible_for_defense=True,
            status="DEFENSE_READY", council=council
        )

        proj_defer = GraduationProject.objects.create(
            student=self.sv2, batch=self.batch, supervisor=self.sup2,
            topic_title_vi="Đồ án Xin Bảo Lưu", supervisor_defense_confirmed=False,
            final_academic_eligibility="INELIGIBLE", deferral_status="REQUESTED"
        )

        # 1. Nhánh Bảo lưu: Khoa duyệt bảo lưu -> chuyển status sang DEFERRED
        defer_resp = self.client.patch(f"/admin/projects/{proj_defer.id}/deferral-decision/", {
            "decision": "APPROVE_DEFERRAL",
            "reason": "Đồng ý bảo lưu kết quả 1 học kỳ theo nguyện vọng"
        }, format="json")
        self.assertEqual(defer_resp.status_code, status.HTTP_200_OK)
        proj_defer.refresh_from_db()
        self.assertEqual(proj_defer.deferral_status, "APPROVED")
        self.assertEqual(proj_defer.status, "DEFERRED")

        # 2. Xếp lịch bảo vệ tự động (Auto Scheduling) cho toàn đợt
        sched_resp = self.client.post("/admin/defense/auto-schedule/", {
            "batch_id": self.batch.id,
            "slot_duration": 40,
            "morning_start": "08:00",
            "afternoon_start": "13:30"
        }, format="json")
        self.assertEqual(sched_resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(sched_resp.data["scheduled_slots_count"], 1)
        self.assertEqual(DefenseScheduleSlot.objects.filter(council=council).count(), 1)

        # 3. Chốt điểm Hội đồng
        fin_score_resp = self.client.post(f"/admin/councils/{council.id}/finalize-scores/")
        self.assertEqual(fin_score_resp.status_code, status.HTTP_200_OK)
        council.refresh_from_db()
        self.assertTrue(council.is_finalized)

        # 4. Xuất Báo cáo tổng hợp cuối kỳ Excel (Đã bao gồm cả SV Bảo lưu)
        export_resp = self.client.get(f"/admin/export/final-summary-excel/?batch_id={self.batch.id}")
        self.assertEqual(export_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(export_resp["Content-Type"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        # 5. Đóng/Kết thúc đợt đồ án
        close_resp = self.client.post(f"/admin/batches/{self.batch.id}/close/")
        self.assertEqual(close_resp.status_code, status.HTTP_200_OK)
        self.batch.refresh_from_db()
        self.assertTrue(self.batch.is_closed)
        self.assertEqual(self.batch.current_stage, "COMPLETED")
