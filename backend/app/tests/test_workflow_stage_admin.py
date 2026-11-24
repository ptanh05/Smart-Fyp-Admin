"""
Admin Portal hiển thị đúng giai đoạn chuẩn hóa (contract workflow_stages) cho
từng đồ án, cùng số giai đoạn mà Sinh viên và GVHD thấy ở Cổng Người dùng.
"""
import json
from pathlib import Path

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from app.models import AcademicBatch, CustomUser, GraduationProject, Student, Supervisor
from app.services.batch_progress import compute_batch_progress
from app.services.workflow_stages import compute_project_progress

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "stage_contract_cases.json"


class AdminWorkflowStageTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        admin = CustomUser.objects.create_user(username="wf_admin", password="x", user_type="admin")
        self.client.force_authenticate(user=admin)
        self.batch = AcademicBatch.objects.create(
            batch_code="WF_ADMIN", batch_name="WF Admin", current_stage="PHASE_3_TOPIC", is_active=True
        )
        sup_user = CustomUser.objects.create_user(username="wf_admin_sup", password="x", user_type="supervisor")
        self.supervisor = Supervisor.objects.create(user=sup_user, supervisor_id="GV-WF-ADMIN")

    def make_project(self, idx, **fields):
        user = CustomUser.objects.create_user(username=f"wf_admin_sv{idx}", password="x", user_type="student")
        student = Student.objects.create(user=user, registration_no=f"WFA{idx:03d}", academic_batch=self.batch)
        return GraduationProject.objects.create(
            student=student, supervisor=self.supervisor, batch=self.batch, topic_title_vi=f"Đề tài {idx}", **fields
        )

    def test_15_admin_project_list_matches_contract_stage(self):
        projects = [
            self.make_project(1, status="OUTLINE_PENDING", topic_review_status="DRAFT"),
            self.make_project(2, status="OUTLINE_PENDING", topic_review_status="GV_CONFIRMED"),
            self.make_project(3, status="OUTLINE_APPROVED", topic_review_status="APPROVED"),
            self.make_project(4, status="DEFERRED", deferral_status="APPROVED"),
        ]
        unassigned_user = CustomUser.objects.create_user(username="wf_admin_free", password="x", user_type="student")
        Student.objects.create(user=unassigned_user, registration_no="WFA999", academic_batch=self.batch)

        response = self.client.get(f"/admin/projects/?batch_id={self.batch.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = {item["id"]: item for item in response.data}

        expected = {projects[0].id: 3, projects[1].id: 3, projects[2].id: 4, projects[3].id: 2}
        for project_id, stage in expected.items():
            self.assertEqual(items[project_id]["workflow_stage_number"], stage)
            self.assertEqual(items[project_id]["workflow"]["current_stage_number"], stage)
        self.assertTrue(items[projects[3].id]["workflow"]["is_blocked"])

        unassigned = [item for item in response.data if item.get("is_unassigned")]
        self.assertEqual(len(unassigned), 1)
        self.assertEqual(unassigned[0]["workflow_stage_number"], 2)

    def test_batch_progress_uses_canonical_numbering(self):
        for code, number in (
            ("PHASE_4_ELIGIBILITY", 4),
            ("PHASE_5_IN_PROGRESS", 5),
            ("PHASE_6_DEFENSE", 6),
        ):
            with self.subTest(code=code):
                self.batch.current_stage = code
                self.batch.save(update_fields=["current_stage"])
                progress = compute_batch_progress(self.batch)
                self.assertEqual(progress["current_stage_number"], number)
                self.assertEqual(progress["stages"][number - 1]["code"], code)
                self.assertEqual(progress["stages"][number - 1]["status"], "active")

    def test_contract_fixture_runs_on_real_models(self):
        """Fixture contract áp lên model thật của Admin (không chỉ SimpleNamespace)."""
        contract = json.loads(FIXTURE.read_text(encoding="utf-8"))
        for idx, case in enumerate(contract["cases"]):
            if case["project"] is None:
                continue
            with self.subTest(case=case["id"]):
                batch_fields = {**contract["batch_defaults"], **case["batch"]}
                batch = AcademicBatch(batch_code=f"C{idx}", batch_name=case["id"], **batch_fields)
                fields = {**contract["project_defaults"], **case["project"]}
                project = GraduationProject(batch=batch, supervisor=self.supervisor, **fields)
                result = compute_project_progress(project)
                self.assertEqual(result["current_stage_number"], case["expected"]["current_stage_number"])
