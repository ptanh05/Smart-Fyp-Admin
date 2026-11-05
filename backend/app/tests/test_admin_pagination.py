import json
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from app.models import (
    AcademicBatch,
    CourseClass,
    Student,
    Supervisor,
    GraduationProject,
    DefenseCouncil,
    AuditLog,
)

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class AdminPaginationTestCase(TestCase):
    """
    Comprehensive test suite for P1.2 Admin Pagination:
    - User management pagination (empty data, boundary, page size, total pages)
    - Backward compatibility (unpaginated requests return legacy format)
    - Filter and search preservation
    - Projects list pagination
    - Councils list pagination
    - Permission checks (non-admin receives 403)
    """

    def setUp(self):
        super().setUp()
        self.client = APIClient()

        # Admin user
        self.admin_user = User.objects.create_user(
            username="admin_test",
            email="admin_test@utc.edu.vn",
            password="adminpassword123",
            user_type="admin",
            is_staff=True,
        )

        # Regular student user (for permission tests)
        self.student_user = User.objects.create_user(
            username="student_regular",
            email="regular@utc.edu.vn",
            password="studentpassword123",
            user_type="student",
        )

        # Batch & class setup
        self.batch = AcademicBatch.objects.create(
            batch_code="K61_PAGINATION",
            batch_name="Khoa 61 Pagination Test",
            is_active=True,
        )
        self.course_class = CourseClass.objects.create(
            batch=self.batch,
            class_code="CNTT1_K61_PAG",
            class_name="Cong nghe thong tin 1",
            program_type="DAI_TRA",
        )

        # Create 35 test student accounts to thoroughly test pagination boundaries
        self.students = []
        for i in range(1, 36):
            u = User.objects.create_user(
                username=f"sv_test_{i:02d}",
                email=f"sv_{i:02d}@lms.utc.edu.vn",
                password="password123",
                first_name=f"Van {chr(65 + (i % 26))}",
                last_name="Nguyen",
                user_type="student",
            )
            st = Student.objects.create(
                user=u,
                registration_no=f"MS_{i:04d}",
                academic_batch=self.batch,
                course_class=self.course_class,
            )
            self.students.append(st)

    def test_permission_denied_for_non_admin(self):
        """Non-admin accounts must be blocked with HTTP 403 Forbidden."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get("/admin/users/?page=1")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_management_pagination_page_1(self):
        """Page 1 with page_size=10 should return exactly 10 users and accurate metadata."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/admin/users/?page=1&page_size=10&user_type=student")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertIn("users", data)
        self.assertIn("total", data)
        self.assertIn("total_pages", data)
        self.assertIn("current_page", data)
        self.assertIn("page_size", data)

        self.assertEqual(data["current_page"], 1)
        self.assertEqual(data["page_size"], 10)
        self.assertEqual(len(data["users"]), 10)
        self.assertEqual(data["total"], 36)  # 35 test + 1 regular student
        self.assertEqual(data["total_pages"], 4)  # ceil(36 / 10) = 4
        self.assertIsNotNone(data["next"])
        self.assertIsNone(data["previous"])

    def test_user_management_pagination_last_page_boundary(self):
        """Last page (page 4) should return the remaining 6 users."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/admin/users/?page=4&page_size=10&user_type=student")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data["current_page"], 4)
        self.assertEqual(len(data["users"]), 6)
        self.assertIsNone(data["next"])
        self.assertIsNotNone(data["previous"])

    def test_user_management_pagination_beyond_boundary(self):
        """Page beyond total_pages should return an empty users array cleanly without 500 error."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/admin/users/?page=99&page_size=10&user_type=student")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(len(data["users"]), 0)
        self.assertEqual(data["total"], 36)
        self.assertEqual(data["current_page"], 99)

    def test_user_management_backward_compatibility_unpaginated(self):
        """When ?page is omitted, returns full unpaginated list matching existing frontend contract."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/admin/users/?user_type=student")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertIn("users", data)
        self.assertIn("total", data)
        self.assertIn("counts", data)
        self.assertEqual(len(data["users"]), 36)
        self.assertEqual(data["total"], 36)

    def test_user_management_filter_preservation_with_pagination(self):
        """Filters (search, class_id) are preserved under pagination."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f"/admin/users/?page=1&page_size=5&class_id={self.course_class.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data["total"], 35)
        self.assertEqual(len(data["users"]), 5)
        for u in data["users"]:
            # course_class in serializer is either the ID or dict with id
            cc = u["student_profile"]["course_class"]
            cc_id = cc["id"] if isinstance(cc, dict) else cc
            self.assertEqual(cc_id, self.course_class.id)

    def test_projects_pagination(self):
        """Projects endpoint /admin/projects/ supports ?page= and ?page_size=."""
        self.client.force_authenticate(user=self.admin_user)

        # Create supervisor and 15 projects
        sup_user = User.objects.create_user(
            username="sup_test",
            email="sup_test@utc.edu.vn",
            password="password123",
            user_type="supervisor"
        )
        sup = Supervisor.objects.create(user=sup_user, supervisor_id="GV_TEST")

        for i in range(15):
            GraduationProject.objects.create(
                batch=self.batch,
                student=self.students[i],
                supervisor=sup,
                topic_title_vi=f"De tai tot nghiep {i+1}",
                status="ALLOCATED"
            )

        # Paginated request
        response = self.client.get(f"/admin/projects/?batch_id={self.batch.id}&page=1&page_size=5")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertIn("results", data)
        self.assertIn("total", data)
        self.assertIn("current_page", data)
        self.assertEqual(data["current_page"], 1)
        self.assertEqual(data["page_size"], 5)
        self.assertEqual(len(data["results"]), 5)
        # 15 projects + 20 unassigned students in batch = 35 total
        self.assertEqual(data["total"], 35)

        # Legacy unpaginated request
        response_legacy = self.client.get(f"/admin/projects/?batch_id={self.batch.id}")
        self.assertEqual(response_legacy.status_code, status.HTTP_200_OK)
        data_legacy = response_legacy.json()
        self.assertIsInstance(data_legacy, list)
        self.assertEqual(len(data_legacy), 35)

    def test_councils_pagination(self):
        """Councils endpoint /admin/councils/ supports ?page= and ?page_size=."""
        self.client.force_authenticate(user=self.admin_user)

        for i in range(12):
            DefenseCouncil.objects.create(
                batch=self.batch,
                council_number=i + 1,
                council_name=f"Hoi dong bao ve {i+1}",
            )

        response = self.client.get(f"/admin/councils/?batch_id={self.batch.id}&page=1&page_size=5")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertIn("results", data)
        self.assertEqual(data["total"], 12)
        self.assertEqual(len(data["results"]), 5)
        self.assertEqual(data["total_pages"], 3)
