"""Regression tests for Outline Review & Outline Group routes and force batch cleanup."""
import datetime

from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from app.models import (
    AcademicBatch,
    CourseClass,
    CustomUser,
    DefenseCouncil,
    DefenseMinutesSignature,
    DefenseScheduleSlot,
    Department,
    GraduationProject,
    OutlineReview,
    OutlineReviewGroup,
    Student,
    Supervisor,
    CouncilMember,
)


class OutlineRoutesAndForceDeleteTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = CustomUser.objects.create_user(
            username="outline_admin",
            email="outline_admin@utc.edu.vn",
            password="AdminPass123!",
            user_type="admin",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_authenticate(user=self.admin)

        self.dept = Department.objects.create(code="CNPM", name="Công nghệ phần mềm")
        self.batch = AcademicBatch.objects.create(
            batch_code="OUTLINE_TEST",
            batch_name="Đợt Test Đề Cương",
            program_type="BACHELOR",
            current_stage="PHASE_3_TOPIC",
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2027, 1, 15),
            is_active=True,
        )
        self.course_class = CourseClass.objects.create(
            batch=self.batch,
            class_code="CNTT_T1",
            class_name="CNTT Test 1",
        )

        self.sup_user = CustomUser.objects.create_user(
            username="gv_outline",
            email="gv_outline@utc.edu.vn",
            password="GvPass123!",
            first_name="Huấn",
            last_name="Vũ",
            user_type="supervisor",
        )
        self.supervisor = Supervisor.objects.create(
            user=self.sup_user,
            supervisor_id="GV_OUTLINE",
            academic_title="TS",
            department_obj=self.dept,
            department_name=self.dept.name,
        )

        self.stu_user = CustomUser.objects.create_user(
            username="9990001",
            email="9990001@sv.utc.edu.vn",
            password="SvPass123!",
            first_name="Lâm",
            last_name="Bùi Ngọc",
            user_type="student",
        )
        self.student = Student.objects.create(
            user=self.stu_user,
            registration_no="9990001",
            course_class=self.course_class,
            academic_batch=self.batch,
        )
        self.project = GraduationProject.objects.create(
            batch=self.batch,
            student=self.student,
            supervisor=self.supervisor,
            topic_title_vi="Hệ thống thử nghiệm quy trình GĐ1-GĐ6",
            status="OUTLINE_PENDING",
        )

    def test_outline_groups_and_reviews_endpoints(self):
        # 1. Create outline group
        create_res = self.client.post(
            "/admin/outline-groups/",
            {
                "batch_id": self.batch.id,
                "name": "Nhóm Thẩm định 1",
                "department": self.dept.name,
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        group_id = create_res.data["id"]

        # 2. List outline groups & update members
        list_grp = self.client.get(f"/admin/outline-groups/?batch_id={self.batch.id}")
        self.assertEqual(list_grp.status_code, status.HTTP_200_OK)
        grp_items = list_grp.data if isinstance(list_grp.data, list) else list_grp.data["results"]
        self.assertEqual(len(grp_items), 1)

        put_res = self.client.put(
            f"/admin/outline-groups/{group_id}/",
            {
                "name": "Nhóm Thẩm định CNPM",
                "department": self.dept.name,
                "members": [self.supervisor.id],
            },
            format="json",
        )
        self.assertEqual(put_res.status_code, status.HTTP_200_OK)
        self.assertEqual(put_res.data["members"], [self.supervisor.id])

        # 3. List outline reviews -> only student project, no crash on open_topic (student=None)
        rev_list = self.client.get(f"/admin/outline-reviews/?batch_id={self.batch.id}")
        self.assertEqual(rev_list.status_code, status.HTTP_200_OK)
        rev_items = rev_list.data if isinstance(rev_list.data, list) else rev_list.data["results"]
        self.assertEqual(len(rev_items), 1)
        self.assertEqual(rev_items[0]["student_reg_no"], "9990001")
        review_id = rev_items[0]["id"]

        # 4. Auto assign to group and approve review
        assign_res = self.client.post(
            "/admin/outline-reviews/assign/",
            {"action": "auto_assign", "batch_id": self.batch.id},
            format="json",
        )
        self.assertEqual(assign_res.status_code, status.HTTP_200_OK)
        self.assertEqual(assign_res.data["assigned_count"], 1)

        patch_res = self.client.patch(
            f"/admin/outline-reviews/{review_id}/",
            {"verdict": "APPROVED", "comments": "Đạt yêu cầu"},
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, "OUTLINE_APPROVED")
        self.assertEqual(self.project.topic_review_status, "APPROVED")

        # 5. Force delete batch with related council, slot, signature & outline group works cleanly
        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_name="HĐ Nháp 1",
            council_number=1,
            session_date=datetime.date(2026, 12, 20),
            session_time="MORNING",
            defense_room="P301",
        )
        member = CouncilMember.objects.create(
            council=council,
            user=self.sup_user,
            supervisor=self.supervisor,
            role="CHAIR",
        )
        self.project.council = council
        self.project.save()
        DefenseScheduleSlot.objects.create(
            council=council,
            project=self.project,
            order_number=1,
            slot_date=datetime.date(2026, 12, 20),
            start_time=datetime.time(8, 0),
            end_time=datetime.time(8, 25),
            room="P301",
        )
        DefenseMinutesSignature.objects.create(
            council=council,
            project=self.project,
            member=member,
            signed_by=self.sup_user,
        )

        del_res = self.client.delete(f"/admin/batches/{self.batch.id}/?force=true")
        self.assertIn(del_res.status_code, (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT))
        self.assertFalse(AcademicBatch.objects.filter(pk=self.batch.id).exists())
        self.assertFalse(OutlineReviewGroup.objects.filter(pk=group_id).exists())
        self.assertFalse(OutlineReview.objects.filter(pk=review_id).exists())
