from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from app.models import (
    AcademicBatch,
    CouncilLiveScore,
    CouncilMember,
    CourseClass,
    CustomUser,
    DefenseCouncil,
    EvaluationPolicy,
    GraduationProject,
    ProjectTopicArea,
    Student,
    Supervisor,
    SupervisorQuota,
)
from app.services.reviewer_engine import ReviewerAndCouncilAllocationEngine


class GD6AdminFixesTests(APITestCase):
    client: APIClient

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.batch = AcademicBatch.objects.create(
            batch_code="ADM_FIX_2026",
            batch_name="Đợt Admin Fix",
            current_stage="PHASE_6_DEFENSE",
            is_active=True,
        )
        EvaluationPolicy.objects.create(
            batch=self.batch,
            weight_supervisor=0.3,
            weight_reviewer=0.2,
            weight_council=0.5,
        )
        self.topic_area = ProjectTopicArea.objects.create(
            name="Web & Cloud", code="WEB_FIX", is_active=True
        )
        self.course_class = CourseClass.objects.create(
            batch=self.batch,
            class_code="CNTT.K63.01",
            class_name="CNTT K63",
            program_type="DAI_TRA",
        )
        self.admin = CustomUser.objects.create_user(
            username="admin_fix", email="admin_fix@utc.edu.vn", password="x",
            user_type="admin", is_staff=True, is_superuser=True
        )
        self.sup_hd = self._make_sup("hd", "Huấn", "Vũ")
        self.sup_rev = self._make_sup("rev", "Long", "Nguyễn Văn")
        self.sup_sec1 = self._make_sup("sec1", "Ngân", "Trần Thị")
        self.sup_sec2 = self._make_sup("sec2", "Dũng", "Bùi Ngọc")
        self.sup_mem1 = self._make_sup("mem1", "Luyến", "Cao Thị")
        self.sup_mem2 = self._make_sup("mem2", "Thông", "Hoàng Văn")

        for s in (self.sup_hd, self.sup_rev, self.sup_sec1, self.sup_sec2, self.sup_mem1, self.sup_mem2):
            SupervisorQuota.objects.create(supervisor=s, batch=self.batch, max_total_quota=10)

        self.st_user = CustomUser.objects.create_user(
            username="999100001", email="999100001@lms.utc.edu.vn", password="x",
            first_name="An", last_name="Nguyễn", user_type="student"
        )
        self.st = Student.objects.create(
            user=self.st_user, registration_no="999100001",
            academic_batch=self.batch, course_class=self.course_class
        )
        self.council = DefenseCouncil.objects.create(
            batch=self.batch, council_number=1, council_name="HĐ 1", defense_room="P301"
        )
        # Sup_hd sits outside council, sup_rev sits inside council as CHAIR
        self.m_chair = CouncilMember.objects.create(council=self.council, supervisor=self.sup_rev, user=self.sup_rev.user, role="CHAIR")
        self.m_sec1 = CouncilMember.objects.create(council=self.council, supervisor=self.sup_sec1, user=self.sup_sec1.user, role="SECRETARY")
        self.m_sec2 = CouncilMember.objects.create(council=self.council, supervisor=self.sup_sec2, user=self.sup_sec2.user, role="SECRETARY")
        self.m_mem1 = CouncilMember.objects.create(council=self.council, supervisor=self.sup_mem1, user=self.sup_mem1.user, role="MEMBER")
        self.m_mem2 = CouncilMember.objects.create(council=self.council, supervisor=self.sup_mem2, user=self.sup_mem2.user, role="MEMBER")

        self.proj = GraduationProject.objects.create(
            student=self.st,
            supervisor=self.sup_hd,
            reviewer=self.sup_rev,
            council=self.council,
            batch=self.batch,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài test",
            status="DEFENDED",
            is_eligible_for_defense=True,
            supervisor_score=8.5,
            reviewer_score=8.0,
        )

    def _make_sup(self, username, first_name, last_name):
        user = CustomUser.objects.create_user(
            username=username, email=f"{username}@utc.edu.vn", password="x",
            first_name=first_name, last_name=last_name, user_type="supervisor"
        )
        return Supervisor.objects.create(
            user=user, supervisor_id=username.upper(), department_name="CNTT"
        )

    def test_finalize_council_scores_excludes_reviewer_conflict(self):
        # All 4 non-reviewer council members submit scores (sup_rev is GVPB -> exempt)
        for m in (self.m_sec1, self.m_sec2, self.m_mem1, self.m_mem2):
            CouncilLiveScore.objects.create(
                council=self.council, project=self.proj, member=m,
                score_presentation=2.5, score_content=2.5, score_qa=1.8, score_demo=1.7, total_score=8.5
            )
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f"/admin/councils/{self.council.id}/finalize-scores/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.council.refresh_from_db()
        self.assertTrue(self.council.is_finalized)

    def test_reviewer_engine_prefers_external_lecturer_outside_council(self):
        # Add an extra lecturer in batch who is NOT in self.council and NOT sup_hd
        ext_sup = self._make_sup("ext_gvpb", "Ngoại", "Phản Biện")
        SupervisorQuota.objects.create(supervisor=ext_sup, batch=self.batch, max_total_quota=10)
        self.proj.council = None
        self.proj.reviewer = None
        self.proj.save(update_fields=["council", "reviewer"])

        result = ReviewerAndCouncilAllocationEngine.assign_councils_and_reviewers(self.batch.id)
        self.assertTrue(result["success"])
        self.proj.refresh_from_db()
        self.assertEqual(self.proj.council_id, self.council.id)
        self.assertEqual(self.proj.reviewer_id, ext_sup.id)
