"""
Test cho CouncilGeneratorEngine (⚡ Sinh Hội đồng tự động - GĐ6)

Kiểm chứng:
  - Cơ cấu 1 Chủ tịch - 2 Thư ký - 2 Ủy viên
  - Tự loại trừ GVHD của sinh viên khỏi hội đồng chấm đề tài đó
  - GVPB (reviewer) luôn khác GVHD
  - Tự gán đề tài & cân bằng tải giảng viên
  - RBAC: giao_vu (academic_staff) bị từ chối truy cập
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from app.models import (
    CustomUser,
    AcademicBatch,
    Department,
    Supervisor,
    SupervisorQuota,
    Student,
    GraduationProject,
    DefenseCouncil,
    CouncilMember,
)
from app.services.council_generator import CouncilGeneratorEngine


class AutoGenerateCouncilTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = CustomUser.objects.create_user(
            username="admin_council",
            email="admin_council@utc.edu.vn",
            password="adminpassword123",
            user_type="admin",
            is_staff=True,
        )

        self.staff = CustomUser.objects.create_user(
            username="giao_vu_council",
            email="giao_vu_council@utc.edu.vn",
            password="staffpassword123",
            user_type="academic_staff",
            is_staff=False,
        )

        self.dept = Department.objects.create(name="Bộ môn CNTT", code="CNPM")

        self.batch = AcademicBatch.objects.create(
            batch_code="2026_K63_KS",
            batch_name="Đợt ĐATN K63 Kỹ sư",
            program_type="ENGINEER",
            current_stage="PHASE_5_COUNCIL",
            is_active=True,
        )

        # 8 giảng viên: 1 GS (Chủ tịch), 3 PGS, 4 TS
        self.supervisors = []
        titles = ["GS", "PGS", "PGS", "PGS", "TS", "TS", "TS", "TS"]
        for idx, title in enumerate(titles, start=1):
            u = CustomUser.objects.create_user(
                username=f"gv_hd_{idx}",
                first_name=f"GiangVien{idx}",
                last_name="UTC",
                user_type="supervisor",
            )
            s = Supervisor.objects.create(
                user=u,
                supervisor_id=f"GV_HD_{idx:02d}",
                academic_title=title,
                academic_rank_multiplier=2.0 if title == "GS" else (1.5 if title == "PGS" else 1.0),
                department_obj=self.dept,
                department_name="CNPM",
            )
            SupervisorQuota.objects.create(
                supervisor=s,
                batch=self.batch,
                base_quota=5,
                rank_multiplier=s.academic_rank_multiplier,
                max_total_quota=5,
            )
            self.supervisors.append(s)

        # 4 sinh viên + đề tài
        self.students = []
        for idx in range(1, 5):
            u = CustomUser.objects.create_user(
                username=f"2022600{idx:03d}",
                first_name=f"SinhVien{idx}",
                last_name="UTC",
                user_type="student",
            )
            st = Student.objects.create(
                user=u,
                registration_no=f"2022600{idx:03d}",
                academic_batch=self.batch,
                education_program="ENGINEER",
            )
            self.students.append(st)

        # GVHD cố định: sv1 -> sup[0], sv2 -> sup[1], sv3 -> sup[2], sv4 -> sup[3]
        self.projects = []
        for st, sup in zip(self.students, self.supervisors[:4]):
            proj = GraduationProject.objects.create(
                student=st,
                batch=self.batch,
                supervisor=sup,
                topic_title_vi=f"Đề tài {st.registration_no}",
                topic_review_status="APPROVED",
                status="DEFENSE_READY",
                is_eligible_for_defense=True,
                final_academic_eligibility="ELIGIBLE",
            )
            self.projects.append(proj)

    def test_generate_councils_structure_1chair_2sec_2member(self):
        """Mỗi hội đồng gồm đúng 5 GV: 1 Chủ tịch, 2 Thư ký, 2 Ủy viên"""
        res = CouncilGeneratorEngine.generate_councils_for_batch(
            batch_id=self.batch.id,
            projects_per_council=8,
        )
        self.assertTrue(res["success"], res.get("error"))
        self.assertGreaterEqual(len(res["councils"]), 1)

        for c in res["councils"]:
            roles = [m["role"] for m in c["members"]]
            self.assertEqual(len(roles), 5, f"HĐ {c['council_name']} phải có đúng 5 thành viên")
            self.assertEqual(roles.count("CHAIR"), 1)
            self.assertEqual(roles.count("SECRETARY"), 2)
            self.assertEqual(roles.count("MEMBER"), 2)

        # Đối chiếu với DB
        for c in res["councils"]:
            council = DefenseCouncil.objects.get(id=c["id"])
            db_roles = list(
                council.members.values_list("role", flat=True)
            )
            self.assertEqual(len(db_roles), 5)
            self.assertEqual(db_roles.count("CHAIR"), 1)
            self.assertEqual(db_roles.count("SECRETARY"), 2)
            self.assertEqual(db_roles.count("MEMBER"), 2)

        # Chủ tịch phải là GV có học vị cao nhất trong HĐ
        # (GS có thể bị loại vì là GVHD của một SV trong nhóm -> tránh xung đột lợi ích)
        chair = res["councils"][0]["members"][0]
        self.assertEqual(chair["role"], "CHAIR")
        titles = [m["academic_title"] for m in res["councils"][0]["members"]]
        chair_rank = CouncilGeneratorEngine.TITLE_RANK.get(chair["academic_title"], 1)
        for t in titles[1:]:
            self.assertLessEqual(
                CouncilGeneratorEngine.TITLE_RANK.get(t, 1),
                chair_rank,
                "Chủ tịch phải có học vị cao nhất trong Hội đồng",
            )

    def test_generate_councils_excludes_supervisor_from_own_student_council(self):
        """GVHD của SV không được là thành viên HĐ chấm đề tài của SV đó"""
        res = CouncilGeneratorEngine.generate_councils_for_batch(
            batch_id=self.batch.id,
            projects_per_council=8,
        )
        self.assertTrue(res["success"], res.get("error"))

        for proj in self.projects:
            proj.refresh_from_db()
            self.assertIsNotNone(proj.council, "Đề tài phải được gán vào hội đồng")
            member_sup_ids = {
                m.supervisor_id for m in proj.council.members.all() if m.supervisor_id
            }
            self.assertNotIn(
                proj.supervisor_id,
                member_sup_ids,
                "GVHD không được tham gia hội đồng chấm đề tài của SV mình",
            )

    def test_generate_councils_assigns_reviewer_different_from_supervisor(self):
        """GVPB luôn khác GVHD"""
        res = CouncilGeneratorEngine.generate_councils_for_batch(
            batch_id=self.batch.id,
            projects_per_council=8,
        )
        self.assertTrue(res["success"], res.get("error"))

        self.assertEqual(res["assigned_reviewers"], len(self.projects))

        for proj in self.projects:
            proj.refresh_from_db()
            self.assertIsNotNone(proj.reviewer, "Phải gán được Giảng viên phản biện")
            self.assertNotEqual(
                proj.reviewer_id,
                proj.supervisor_id,
                "GVPB phải khác GVHD",
            )
            # GVPB phải là thành viên của hội đồng đó
            member_ids = {
                m.supervisor_id for m in proj.council.members.all() if m.supervisor_id
            }
            self.assertIn(proj.reviewer_id, member_ids)

    def test_generate_councils_via_api_endpoint(self):
        """API /admin/councils/auto-generate/ hoạt động với admin"""
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/admin/councils/auto-generate/", {
            "batch_id": self.batch.id,
            "projects_per_council": 8,
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["success"])
        self.assertGreaterEqual(len(resp.data["councils"]), 1)

        # Cấu trúc phản hồi
        for c in resp.data["councils"]:
            self.assertIn("id", c)
            self.assertIn("council_name", c)
            self.assertIn("defense_room", c)
            self.assertIn("members", c)

    def test_generate_councils_endpoint_allows_academic_staff(self):
        """Giáo vụ Khoa (giao_vu) được phép thành lập Hội đồng (nghiệp vụ thuộc Khoa)"""
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post("/admin/councils/auto-generate/", {
            "batch_id": self.batch.id,
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["success"])

    def test_generate_councils_endpoint_denies_student_and_supervisor(self):
        """Sinh viên & Giảng viên KHÔNG được gọi API thành lập Hội đồng"""
        student_user = CustomUser.objects.create_user(
            username="sv_khong_quyen",
            email="sv_khong_quyen@utc.edu.vn",
            password="studentpassword123",
            user_type="student",
        )
        sup_user = CustomUser.objects.create_user(
            username="gv_khong_quyen",
            email="gv_khong_quyen@utc.edu.vn",
            password="suppassword123",
            user_type="supervisor",
        )

        for u in (student_user, sup_user):
            self.client.force_authenticate(user=u)
            resp = self.client.post("/admin/councils/auto-generate/", {
                "batch_id": self.batch.id,
            }, format="json")
            self.assertEqual(
                resp.status_code,
                status.HTTP_403_FORBIDDEN,
                f"{u.user_type} không được phép sinh Hội đồng",
            )

    def test_generate_councils_requires_five_supervisors(self):
        """Cần tối thiểu 5 GV để lập Hội đồng chuẩn"""
        Supervisor.objects.filter(
            supervisor_id__in=[f"GV_HD_{i:02d}" for i in range(4, 9)]
        ).delete()
        res = CouncilGeneratorEngine.generate_councils_for_batch(
            batch_id=self.batch.id,
        )
        self.assertFalse(res["success"])
        self.assertIn("05 Giảng viên", res["error"])

    def test_generate_councils_rejects_empty_batch(self):
        """Đợt không có đề tài -> báo lỗi rõ ràng"""
        empty_batch = AcademicBatch.objects.create(
            batch_code="2026_EMPTY",
            batch_name="Đợt trống",
            program_type="BOTH",
            current_stage="PHASE_5_COUNCIL",
            is_active=True,
        )
        res = CouncilGeneratorEngine.generate_councils_for_batch(
            batch_id=empty_batch.id,
        )
        self.assertFalse(res["success"])
        self.assertIn("chưa có đề tài", res["error"])

    def test_generate_councils_replaces_previous_unfinalized_councils(self):
        """Bấm lại nút thay thế hội đồng cũ chưa chấm điểm"""
        self.client.force_authenticate(user=self.admin)
        first = self.client.post("/admin/councils/auto-generate/", {
            "batch_id": self.batch.id,
        }, format="json")
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        first_ids = set(DefenseCouncil.objects.values_list("id", flat=True))

        second = self.client.post("/admin/councils/auto-generate/", {
            "batch_id": self.batch.id,
        }, format="json")
        self.assertEqual(second.status_code, status.HTTP_200_OK)

        # Không nhân bản hội đồng
        self.assertEqual(
            DefenseCouncil.objects.filter(batch=self.batch).count(),
            len(second.data["councils"]),
            "Không được nhân bản hội đồng khi bấm lại nút",
        )
        # ID cũ đã bị xóa (hội đồng chưa finalize)
        remaining = set(DefenseCouncil.objects.values_list("id", flat=True))
        self.assertFalse(first_ids & remaining)
