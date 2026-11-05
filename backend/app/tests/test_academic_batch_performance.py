from django.test import TestCase
from django.urls import reverse
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework import status

from app.models import CustomUser, AcademicBatch, CourseClass, Student, GraduationProject, Supervisor
from app.views import BATCHES_CACHE_KEY


class AcademicBatchPerformanceTestCase(TestCase):
    """
    Test suite verifying P0.1 optimization:
    Ensures GET /admin/batches/ executes in O(1) queries (exactly 2 queries)
    regardless of the number of batches, classes, or students.
    """

    def setUp(self):
        self.client = APIClient()
        self.admin = CustomUser.objects.create_user(
            username="admin_perf_test",
            password="adminpassword123",
            user_type="admin",
            is_active=True
        )
        self.client.force_authenticate(user=self.admin)
        cache.delete(BATCHES_CACHE_KEY)

        # Create supervisor
        self.sup_user = CustomUser.objects.create_user(
            username="sup_perf_test",
            password="password123",
            user_type="supervisor"
        )
        self.supervisor = Supervisor.objects.create(
            user=self.sup_user,
            supervisor_id="GV_PERF_01"
        )

        # Batch 1: Has classes, students, projects
        self.batch1 = AcademicBatch.objects.create(
            batch_code="PERF_B1",
            batch_name="Đợt Performance 1",
            program_type="BOTH"
        )
        self.class1_1 = CourseClass.objects.create(
            batch=self.batch1,
            class_code="CLASS_1_1",
            class_name="Lớp 1.1"
        )
        self.class1_2 = CourseClass.objects.create(
            batch=self.batch1,
            class_code="CLASS_1_2",
            class_name="Lớp 1.2"
        )
        for i in range(3):
            u = CustomUser.objects.create_user(username=f"st_b1_{i}", user_type="student")
            st = Student.objects.create(
                user=u,
                registration_no=f"PERF_ST_B1_{i}",
                academic_batch=self.batch1,
                course_class=self.class1_1
            )
            GraduationProject.objects.create(
                student=st,
                supervisor=self.supervisor,
                batch=self.batch1,
                topic_title_vi=f"Đề tài B1 {i}"
            )

        # Batch 2: Has classes but 0 students, 0 projects
        self.batch2 = AcademicBatch.objects.create(
            batch_code="PERF_B2",
            batch_name="Đợt Performance 2",
            program_type="BACHELOR"
        )
        self.class2_1 = CourseClass.objects.create(
            batch=self.batch2,
            class_code="CLASS_2_1",
            class_name="Lớp 2.1"
        )

        # Batch 3: 0 classes, 0 students, 0 projects
        self.batch3 = AcademicBatch.objects.create(
            batch_code="PERF_B3",
            batch_name="Đợt Performance 3",
            program_type="ENGINEER"
        )

    def test_academic_batch_list_query_count(self):
        """Verify GET /admin/batches/ executes in exactly 2 SQL queries (zero N+1)"""
        cache.delete(BATCHES_CACHE_KEY)

        with self.assertNumQueries(2):
            response = self.client.get("/admin/batches/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

        # Verify accurate counts on Batch 1
        b1_data = next(b for b in response.data if b["id"] == self.batch1.id)
        self.assertEqual(b1_data["student_count"], 3)
        self.assertEqual(b1_data["project_count"], 3)
        self.assertEqual(len(b1_data["classes"]), 2)
        c1_1_data = next(c for c in b1_data["classes"] if c["id"] == self.class1_1.id)
        self.assertEqual(c1_1_data["student_count"], 3)
        c1_2_data = next(c for c in b1_data["classes"] if c["id"] == self.class1_2.id)
        self.assertEqual(c1_2_data["student_count"], 0)

        # Verify accurate counts on Batch 2
        b2_data = next(b for b in response.data if b["id"] == self.batch2.id)
        self.assertEqual(b2_data["student_count"], 0)
        self.assertEqual(b2_data["project_count"], 0)
        self.assertEqual(len(b2_data["classes"]), 1)
        self.assertEqual(b2_data["classes"][0]["student_count"], 0)

        # Verify accurate counts on Batch 3
        b3_data = next(b for b in response.data if b["id"] == self.batch3.id)
        self.assertEqual(b3_data["student_count"], 0)
        self.assertEqual(b3_data["project_count"], 0)
        self.assertEqual(len(b3_data["classes"]), 0)

    def test_academic_batch_detail_query_count(self):
        """Verify GET /admin/batches/<id>/ executes in exactly 2 SQL queries"""
        with self.assertNumQueries(2):
            response = self.client.get(f"/admin/batches/{self.batch1.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["student_count"], 3)
        self.assertEqual(response.data["project_count"], 3)
        self.assertEqual(len(response.data["classes"]), 2)

    def test_academic_batch_create(self):
        """Verify POST /admin/batches/ creates batch and serializes properly"""
        payload = {
            "batch_code": "PERF_NEW_BATCH",
            "batch_name": "Đợt mới tạo",
            "program_type": "BACHELOR"
        }
        response = self.client.post("/admin/batches/", data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["student_count"], 0)
        self.assertEqual(response.data["project_count"], 0)
        self.assertEqual(response.data["classes"], [])

