from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from app.models import (
    CustomUser,
    AcademicBatch,
    CourseClass,
    Student,
    Supervisor,
    ProjectTopicArea,
    StudentPreference,
    InternshipInfo,
    GraduationProject,
    DefenseCouncil,
)


class GraduationProjectsPerformanceTestCase(TestCase):
    """
    Regression test suite for P0.2 optimization:
    Ensures GET /admin/projects/?batch_id=X executes in O(1) queries (maximum 4 queries)
    regardless of how many unassigned students or projects exist in the batch.
    """

    def setUp(self):
        self.client = APIClient()
        self.admin = CustomUser.objects.create_user(
            username="admin_p02_test",
            password="adminpassword123",
            user_type="admin",
            is_active=True
        )
        self.client.force_authenticate(user=self.admin)

        self.supervisor_user = CustomUser.objects.create_user(
            username="sup_p02_test",
            first_name="Nguyễn Văn",
            last_name="A",
            user_type="supervisor"
        )
        self.supervisor = Supervisor.objects.create(
            user=self.supervisor_user,
            supervisor_id="GV_P02_01",
            academic_title="TS."
        )

        self.topic_area = ProjectTopicArea.objects.create(
            name="Trí tuệ nhân tạo & Xử lý ngôn ngữ tự nhiên"
        )

        # Batch 1: Mixed (has assigned projects + unassigned students)
        self.batch_mixed = AcademicBatch.objects.create(
            batch_code="BATCH_P02_MIXED",
            batch_name="Đợt Mixed P0.2",
            program_type="BOTH"
        )
        self.class1 = CourseClass.objects.create(
            batch=self.batch_mixed,
            class_code="CLASS_P02_1",
            class_name="Lớp P02.1"
        )

        # 3 Assigned students with GraduationProjects
        for i in range(3):
            u = CustomUser.objects.create_user(
                username=f"st_assigned_{i}",
                first_name=f"Văn {i}",
                last_name="Trần",
                user_type="student"
            )
            st = Student.objects.create(
                user=u,
                registration_no=f"ST_ASSIGN_{i}",
                academic_batch=self.batch_mixed,
                course_class=self.class1
            )
            GraduationProject.objects.create(
                student=st,
                supervisor=self.supervisor,
                batch=self.batch_mixed,
                topic_category=self.topic_area,
                topic_title_vi=f"Đề tài đã phân công {i}",
                status="ALLOCATED"
            )

        # 5 Unassigned students (with preferences and surveys)
        for i in range(5):
            u = CustomUser.objects.create_user(
                username=f"st_unassigned_{i}",
                first_name=f"Thị {i}",
                last_name="Lê",
                user_type="student"
            )
            st = Student.objects.create(
                user=u,
                registration_no=f"ST_UNASSIGN_{i}",
                academic_batch=self.batch_mixed,
                course_class=self.class1
            )
            StudentPreference.objects.create(
                student=st,
                batch=self.batch_mixed,
                topic_direction=self.topic_area,
                preference_1=self.supervisor
            )
            InternshipInfo.objects.create(
                student=st,
                batch=self.batch_mixed,
                tentative_title=f"Đề cương sơ bộ khảo sát {i}"
            )

        # Batch 2: Empty Batch (0 students, 0 projects)
        self.batch_empty = AcademicBatch.objects.create(
            batch_code="BATCH_P02_EMPTY",
            batch_name="Đợt Empty P0.2",
            program_type="BACHELOR"
        )

    def test_mixed_batch_query_count_and_data(self):
        """
        Verify that fetching a batch with 3 assigned projects and 5 unassigned students
        executes in exactly 4 SQL queries (zero N+1) and returns 8 items.
        """
        # Queries expected:
        # 1. GraduationProject.objects.filter(batch_id=...) with select_related
        # 2. Student.objects.filter(academic_batch_id=...).exclude(...) with select_related
        # 3. StudentPreference.objects.filter(student_id__in=...) with select_related
        # 4. InternshipInfo.objects.filter(student_id__in=...).only(...)
        with self.assertNumQueries(4):
            response = self.client.get(f"/admin/projects/?batch_id={self.batch_mixed.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 8)

        # Verify 3 assigned projects
        assigned_items = [item for item in response.data if not item.get("is_unassigned")]
        self.assertEqual(len(assigned_items), 3)
        for p in assigned_items:
            self.assertEqual(p["status"], "ALLOCATED")
            self.assertEqual(p["supervisor_name"], "TS. Nguyễn Văn A")

        # Verify 5 unassigned items
        unassigned_items = [item for item in response.data if item.get("is_unassigned")]
        self.assertEqual(len(unassigned_items), 5)
        for u in unassigned_items:
            self.assertEqual(u["status"], "UNASSIGNED")
            self.assertTrue(u["id"] < 0)  # Negative id contract
            self.assertEqual(u["supervisor_name"], "Chưa phân công")
            self.assertEqual(u["preference_1_name"], "TS. Nguyễn Văn A")
            self.assertTrue("Đề cương sơ bộ khảo sát" in u["topic_title_vi"])

    def test_empty_batch_query_count(self):
        """Verify empty batch executes in 2 queries (projects + unassigned check)"""
        with self.assertNumQueries(2):
            response = self.client.get(f"/admin/projects/?batch_id={self.batch_empty.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_filter_by_status_does_not_append_unassigned(self):
        """When status filter is active, unassigned students must NOT be included"""
        # Only 1 query to fetch GraduationProject
        with self.assertNumQueries(1):
            response = self.client.get(f"/admin/projects/?batch_id={self.batch_mixed.id}&status=ALLOCATED")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)
        for item in response.data:
            self.assertFalse(item.get("is_unassigned"))

    def test_nonexistent_batch_returns_empty(self):
        """Non-existent batch_id returns 200 OK with empty array []"""
        response = self.client.get("/admin/projects/?batch_id=999999")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_authentication_required(self):
        """Anonymous access must be rejected with 401 Unauthorized"""
        self.client.force_authenticate(user=None)
        response = self.client.get(f"/admin/projects/?batch_id={self.batch_mixed.id}")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
