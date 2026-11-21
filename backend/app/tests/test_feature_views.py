"""
Tests for feature extension endpoints (analytics, rubrics, archive, data retention).

Runs against SQLite :memory: (IS_TESTING flag in settings.py).
Unmanaged (mirrored) tables are created by LegacyTableTestRunner.
"""
import json
from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from app.models import (
    CustomUser, AcademicBatch, GraduationProject, Supervisor, AuditLog, Department, Student,
)
from app.feature_models import Rubric, RubricCriterion, RubricScore, ThesisArchiveRecord


class FeatureViewTestCase(TestCase):
    """Base: creates admin user and authenticates the test client."""

    def setUp(self):
        self.client = APIClient()
        self.admin = CustomUser.objects.create_user(
            username="feat_admin",
            email="feat_admin@utc.edu.vn",
            password="AdminPass123!",
            user_type="admin",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.admin)

        # Shared batch
        self.batch = AcademicBatch.objects.create(
            batch_code="K63-2026",
            batch_name="K63 HK1 2026-2027",
            is_active=True,
            is_closed=False,
        )

        # Supervisor + project for analytics tests
        self.sup_user = CustomUser.objects.create_user(
            username="sup_feat",
            email="sup_feat@utc.edu.vn",
            password="pass",
            user_type="supervisor",
        )
        self.supervisor = Supervisor.objects.create(
            user=self.sup_user,
            supervisor_id="GV-FEAT-01",
        )
        # student_id is NOT NULL in SQLite (SeparateDatabaseAndState migration
        # only updates ORM state, not actual DB schema)
        self.stu_user = CustomUser.objects.create_user(
            username="stu_feat",
            email="stu_feat@utc.edu.vn",
            password="pass",
            user_type="student",
        )
        self.student = Student.objects.create(
            user=self.stu_user,
            registration_no="SV-FEAT-01",
        )
        self.project = GraduationProject.objects.create(
            supervisor=self.supervisor,
            student=self.student,
            batch=self.batch,
            topic_title_vi="Test Project Title",
            status="PASSED",
        )


class TestFacultyAnalytics(FeatureViewTestCase):
    def test_analytics_ok(self):
        resp = self.client.get("/app/admin/analytics/faculty/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn("total_projects", data)
        self.assertIn("score_distribution", data)
        self.assertIn("supervisor_load", data)

    def test_analytics_filter_batch(self):
        resp = self.client.get(f"/app/admin/analytics/faculty/?batch_id={self.batch.id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["batch_id"], str(self.batch.id))
        self.assertEqual(data["total_projects"], 1)

    def test_analytics_requires_auth(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get("/app/admin/analytics/faculty/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_analytics_forbidden_non_admin(self):
        # re-use the student user created in setUp
        self.client.force_authenticate(user=self.stu_user)
        resp = self.client.get("/app/admin/analytics/faculty/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class TestScoreDiscrepancy(FeatureViewTestCase):
    def test_discrepancy_ok(self):
        resp = self.client.get("/app/admin/analytics/score-discrepancy/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn("count", data)
        self.assertIn("results", data)

    def test_discrepancy_filter_batch(self):
        resp = self.client.get(
            f"/app/admin/analytics/score-discrepancy/?batch_id={self.batch.id}&threshold=1.0"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_draft_rubric_scores_do_not_count_as_discrepancy(self):
        """Regression: only SUBMITTED rubric scores are final; drafts must not trigger a warning."""
        self.project.supervisor_score = 8.0
        self.project.save(update_fields=["supervisor_score"])
        rubric = Rubric.objects.create(name="Reviewer", evaluator_role="REVIEWER")
        rs = RubricScore.objects.create(
            project=self.project, rubric=rubric, evaluator=self.admin,
            criterion_scores={}, total_10=3.0, status="DRAFT",
        )
        url = f"/app/admin/analytics/score-discrepancy/?batch_id={self.batch.id}&threshold=2.0"
        ids = [r.get("project_id") for r in self.client.get(url).json()["results"]]
        self.assertNotIn(self.project.id, ids)

        rs.status = "SUBMITTED"
        rs.save(update_fields=["status"])
        ids = [r.get("project_id") for r in self.client.get(url).json()["results"]]
        self.assertIn(self.project.id, ids)


class TestRubricCRUD(FeatureViewTestCase):
    def test_create_rubric(self):
        payload = {
            "name": "GV Hướng Dẫn Rubric",
            "evaluator_role": "SUPERVISOR",
            "description": "Rubric cho GVHD",
            "is_active": True,
        }
        resp = self.client.post("/app/admin/rubrics/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["name"], "GV Hướng Dẫn Rubric")
        self.assertTrue(AuditLog.objects.filter(action_type="admin_rubric_create").exists())

    def test_list_rubrics(self):
        Rubric.objects.create(name="R1", evaluator_role="SUPERVISOR")
        Rubric.objects.create(name="R2", evaluator_role="COUNCIL")
        resp = self.client.get("/app/admin/rubrics/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(resp.json()), 2)

    def test_list_rubrics_filter_role(self):
        Rubric.objects.create(name="R_SUPER", evaluator_role="SUPERVISOR")
        resp = self.client.get("/app/admin/rubrics/?role=SUPERVISOR")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for r in resp.json():
            self.assertEqual(r["evaluator_role"], "SUPERVISOR")

    def test_get_rubric_detail(self):
        rubric = Rubric.objects.create(name="Detail R", evaluator_role="REVIEWER")
        resp = self.client.get(f"/app/admin/rubrics/{rubric.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["name"], "Detail R")

    def test_update_rubric(self):
        rubric = Rubric.objects.create(name="Old Name", evaluator_role="SUPERVISOR")
        resp = self.client.patch(
            f"/app/admin/rubrics/{rubric.id}/",
            {"name": "New Name"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["name"], "New Name")
        self.assertTrue(AuditLog.objects.filter(action_type="admin_rubric_update").exists())

    def test_delete_rubric_no_scores(self):
        rubric = Rubric.objects.create(name="Delete Me", evaluator_role="SUPERVISOR")
        resp = self.client.delete(f"/app/admin/rubrics/{rubric.id}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Rubric.objects.filter(id=rubric.id).exists())
        self.assertTrue(AuditLog.objects.filter(action_type="admin_rubric_delete").exists())

    def test_delete_rubric_with_scores_deactivates(self):
        rubric = Rubric.objects.create(name="Has Scores", evaluator_role="SUPERVISOR")
        RubricScore.objects.create(
            project=self.project,
            rubric=rubric,
            evaluator=self.admin,
            criterion_scores={},
            total_10=7.5,
        )
        resp = self.client.delete(f"/app/admin/rubrics/{rubric.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertTrue(data.get("deactivated"))
        rubric.refresh_from_db()
        self.assertFalse(rubric.is_active)
        self.assertTrue(AuditLog.objects.filter(action_type="admin_rubric_deactivate").exists())

    def test_activate_rubric(self):
        rubric = Rubric.objects.create(name="Inactive R", evaluator_role="SUPERVISOR", is_active=False)
        resp = self.client.post(f"/app/admin/rubrics/{rubric.id}/activate/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        rubric.refresh_from_db()
        self.assertTrue(rubric.is_active)
        self.assertTrue(AuditLog.objects.filter(action_type="admin_rubric_activate").exists())

    def test_create_with_criteria(self):
        payload = {
            "name": "With Criteria",
            "evaluator_role": "COUNCIL",
            "criteria": [
                {"name": "Presentation", "max_score": 4.0, "order": 0},
                {"name": "Content", "max_score": 6.0, "order": 1},
            ],
        }
        resp = self.client.post("/app/admin/rubrics/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        rubric_id = resp.json()["id"]
        criteria_resp = self.client.get(f"/app/admin/rubrics/{rubric_id}/criteria/")
        self.assertEqual(criteria_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(criteria_resp.json()), 2)

    def test_criterion_crud(self):
        rubric = Rubric.objects.create(name="Crit Rubric", evaluator_role="SUPERVISOR")
        # Create criterion
        resp = self.client.post(
            f"/app/admin/rubrics/{rubric.id}/criteria/",
            {"name": "Accuracy", "max_score": 5.0, "order": 0},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        crit_id = resp.json()["id"]

        # Update criterion
        resp2 = self.client.patch(
            f"/app/admin/rubrics/{rubric.id}/criteria/{crit_id}/",
            {"name": "Accuracy Updated"},
            format="json",
        )
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(resp2.json()["name"], "Accuracy Updated")

        # Delete criterion
        resp3 = self.client.delete(f"/app/admin/rubrics/{rubric.id}/criteria/{crit_id}/")
        self.assertEqual(resp3.status_code, status.HTTP_204_NO_CONTENT)

    def test_rubric_404(self):
        resp = self.client.get("/app/admin/rubrics/99999/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class TestThesisArchive(FeatureViewTestCase):
    def setUp(self):
        super().setUp()
        self.archive = ThesisArchiveRecord.objects.create(
            project=self.project,
            title="Archive Title",
            visibility="PUBLIC",
        )

    def test_list_archive(self):
        resp = self.client.get("/app/admin/archive/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn("count", data)
        self.assertIn("results", data)
        self.assertGreaterEqual(data["count"], 1)

    def test_filter_by_visibility(self):
        resp = self.client.get("/app/admin/archive/?visibility=PUBLIC")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for r in resp.json()["results"]:
            self.assertEqual(r["visibility"], "PUBLIC")

    def test_filter_keyword(self):
        resp = self.client.get("/app/admin/archive/?keyword=Archive")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.json()["count"], 1)

    def test_set_embargo(self):
        future = (date.today() + timedelta(days=365)).isoformat()
        resp = self.client.post(
            f"/app/admin/archive/{self.archive.id}/embargo/",
            {
                "embargo_reason": "Chờ công bố bài báo",
                "embargo_until": future,
                "max_years": 2,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["visibility"], "EMBARGOED")
        self.assertTrue(AuditLog.objects.filter(action_type="admin_archive_embargo_set").exists())

    def test_set_embargo_no_reason_fails(self):
        resp = self.client.post(
            f"/app/admin/archive/{self.archive.id}/embargo/",
            {"embargo_until": "2028-01-01"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_lift_embargo(self):
        self.archive.visibility = "EMBARGOED"
        self.archive.embargo_reason = "test"
        self.archive.save()

        resp = self.client.delete(f"/app/admin/archive/{self.archive.id}/embargo/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["visibility"], "PUBLIC")
        self.assertTrue(AuditLog.objects.filter(action_type="admin_archive_embargo_lift").exists())

    def test_embargo_exceeds_max_years(self):
        future = (date.today() + timedelta(days=365 * 10)).isoformat()
        resp = self.client.post(
            f"/app/admin/archive/{self.archive.id}/embargo/",
            {"embargo_reason": "Too long", "embargo_until": future, "max_years": 3},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_archive_404(self):
        resp = self.client.post(
            "/app/admin/archive/99999/embargo/",
            {"embargo_reason": "x"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class TestDataRetention(FeatureViewTestCase):
    def test_preview_ok(self):
        resp = self.client.get("/app/admin/data-retention/preview/?years=1")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn("years", data)
        self.assertIn("cutoff", data)
        self.assertIn("counts", data)
        self.assertIn("batches", data)

    def test_apply_requires_confirm(self):
        resp = self.client.post(
            "/app/admin/data-retention/apply/",
            {"years": 1},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("confirm", resp.json()["detail"])

    def test_apply_with_confirm_no_eligible_batches(self):
        """With no closed batches older than years, returns no-op response."""
        resp = self.client.post(
            "/app/admin/data-retention/apply/",
            {"years": 100, "confirm": "CONFIRM_DELETE"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        # Either no eligible batches found or applied=True with 0 counts
        self.assertIn("years", data)

    def test_apply_writes_audit_when_batches_exist(self):
        # Create a closed batch with end_date > 1 year ago
        old_batch = AcademicBatch.objects.create(
            batch_code="K50-OLD",
            batch_name="K50 HK1 2020",
            is_closed=True,
            is_active=False,
            end_date=date.today() - timedelta(days=400),
        )
        resp = self.client.post(
            "/app/admin/data-retention/apply/",
            {"years": 1, "confirm": "CONFIRM_DELETE"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertTrue(data.get("applied"))
        self.assertTrue(
            AuditLog.objects.filter(action_type="admin_data_retention_apply").exists()
        )

    def test_zero_or_negative_years_rejected_and_nothing_deleted(self):
        """Regression: years<=0 puts the cutoff in the future and would wipe recent batches."""
        recent = AcademicBatch.objects.create(
            batch_code="K66-RECENT", batch_name="Vừa đóng", is_closed=True,
            is_active=False, end_date=date.today() - timedelta(days=30),
        )
        for bad in (0, -1):
            resp = self.client.post(
                "/app/admin/data-retention/apply/",
                {"years": bad, "confirm": "CONFIRM_DELETE"},
                format="json",
            )
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        resp = self.client.get("/app/admin/data-retention/preview/?years=-5")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        resp = self.client.post(
            "/app/admin/data-retention/apply/",
            {"years": "abc", "confirm": "CONFIRM_DELETE"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            AuditLog.objects.filter(action_type="admin_data_retention_apply").exists()
        )
        self.assertTrue(AcademicBatch.objects.filter(pk=recent.pk).exists())


class TestFeatureAuditLogs(FeatureViewTestCase):
    def setUp(self):
        super().setUp()
        # Seed a feature audit log
        AuditLog.objects.create(
            user=self.admin,
            action_type="admin_rubric_create",
            description="Test rubric created",
        )

    def test_list_feature_audit_logs(self):
        resp = self.client.get("/app/admin/audit-logs/features/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn("count", data)
        self.assertIn("results", data)
        self.assertGreaterEqual(data["count"], 1)

    def test_filter_by_action_type(self):
        resp = self.client.get("/app/admin/audit-logs/features/?action_type=admin_rubric_create")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for log in resp.json()["results"]:
            self.assertEqual(log["action_type"], "admin_rubric_create")

    def test_non_admin_forbidden(self):
        student = CustomUser.objects.create_user(
            username="stu_audit",
            email="stu_audit@utc.edu.vn",
            password="pass",
            user_type="student",
        )
        self.client.force_authenticate(user=student)
        resp = self.client.get("/app/admin/audit-logs/features/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
