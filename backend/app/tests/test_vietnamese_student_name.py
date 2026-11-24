from types import SimpleNamespace

from django.test import SimpleTestCase

from app.serializers import GraduationProjectAdminSerializer


class VietnameseStudentNameSerializerTests(SimpleTestCase):
    def test_admin_project_uses_surname_middle_name_before_given_name(self):
        user = SimpleNamespace(
            last_name="Phan Anh",
            first_name="Hà",
            username="202600086",
        )
        project = SimpleNamespace(student=SimpleNamespace(user=user))

        name = GraduationProjectAdminSerializer().get_student_name(project)

        self.assertEqual(name, "Phan Anh Hà")

    def test_admin_project_falls_back_to_username_when_name_is_empty(self):
        user = SimpleNamespace(last_name="", first_name="", username="202600086")
        project = SimpleNamespace(student=SimpleNamespace(user=user))

        name = GraduationProjectAdminSerializer().get_student_name(project)

        self.assertEqual(name, "202600086")
