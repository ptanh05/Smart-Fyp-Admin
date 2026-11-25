"""
Tests for Smart-Fyp-Admin enhancement suite:
- OpenAPI 3.0 schema & Swagger UI docs
- Batch edit/delete guard & BatchMilestone CRUD/seed + progress sync
- Supplementary Registration (open, preserve assigned, finalize, close/finalize guards)
- Manual Academic Record edit + Admin Deferral creation
- Manual DefenseScheduleSlot CRUD + conflict checks (Room, Time, COI) + Reopen/Notify + Signatures
- Real Security Center (UserSessionLog tracking, instant remote revocation, dynamic SecurityPolicy)
- ProjectTopicArea CRUD + in-use delete protection
"""
import datetime

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from app.models import (
    AcademicBatch,
    BatchMilestone,
    CouncilMember,
    CustomUser,
    DefenseCouncil,
    DefenseMinutesSignature,
    DefenseScheduleSlot,
    Department,
    GraduationProject,
    InternshipInfo,
    Notification,
    ProjectTopicArea,
    SecurityPolicy,
    Student,
    StudentPreference,
    Supervisor,
    SupervisorQuota,
    SupervisorTopicArea,
    ThesisDeferralRequest,
    UserSessionLog,
)


class EnhancementsBaseTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = CustomUser.objects.create_user(
            username="enh_admin",
            email="enh_admin@utc.edu.vn",
            password="AdminPass123!",
            user_type="admin",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_authenticate(user=self.admin)

        self.dept = Department.objects.create(code="CNPM", name="Công nghệ phần mềm")
        self.topic_sw = ProjectTopicArea.objects.create(code="SW", name="Phát triển phần mềm", is_active=True)
        self.topic_ai = ProjectTopicArea.objects.create(code="AI", name="Trí tuệ nhân tạo", is_active=True)

        self.batch = AcademicBatch.objects.create(
            batch_code="K64-ENH",
            batch_name="Đợt Nâng Cấp K64",
            program_type="BACHELOR",
            current_stage="PHASE_2_ALLOCATING",
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2027, 1, 15),
            is_active=True,
            is_closed=False,
        )

        self.sup1_user = CustomUser.objects.create_user(
            username="gv1_enh",
            email="gv1_enh@utc.edu.vn",
            password="GvPass123!",
            first_name="An",
            last_name="Nguyễn Văn",
            user_type="supervisor",
        )
        self.sup1 = Supervisor.objects.create(
            user=self.sup1_user,
            supervisor_id="GV001",
            academic_title="TS",
            department_obj=self.dept,
            department_name=self.dept.name,
            academic_rank_multiplier=1.2,
        )
        SupervisorTopicArea.objects.create(supervisor=self.sup1, topic_area=self.topic_sw)

        self.sup2_user = CustomUser.objects.create_user(
            username="gv2_enh",
            email="gv2_enh@utc.edu.vn",
            password="GvPass123!",
            first_name="Bình",
            last_name="Trần Thị",
            user_type="supervisor",
        )
        self.sup2 = Supervisor.objects.create(
            user=self.sup2_user,
            supervisor_id="GV002",
            academic_title="PGS.TS",
            department_obj=self.dept,
            department_name=self.dept.name,
            academic_rank_multiplier=1.5,
        )
        SupervisorTopicArea.objects.create(supervisor=self.sup2, topic_area=self.topic_ai)

        self.sv1_user = CustomUser.objects.create_user(
            username="sv1_enh",
            email="sv1_enh@utc.edu.vn",
            password="SvPass123!",
            first_name="Cường",
            last_name="Lê",
            user_type="student",
        )
        self.sv1 = Student.objects.create(
            user=self.sv1_user,
            registration_no="20260001",
            academic_batch=self.batch,
            education_program="BACHELOR",
        )

        self.sv2_user = CustomUser.objects.create_user(
            username="sv2_enh",
            email="sv2_enh@utc.edu.vn",
            password="SvPass123!",
            first_name="Dung",
            last_name="Phạm",
            user_type="student",
        )
        self.sv2 = Student.objects.create(
            user=self.sv2_user,
            registration_no="20260002",
            academic_batch=self.batch,
            education_program="BACHELOR",
        )


class OpenAPIAndBatchMilestoneTests(EnhancementsBaseTestCase):
    def test_openapi_schema_and_swagger_ui_served(self):
        schema_res = self.client.get("/api/schema/")
        self.assertEqual(schema_res.status_code, status.HTTP_200_OK)
        self.assertEqual(schema_res.json().get("openapi"), "3.0.3")
        self.assertIn("/admin/batches/", schema_res.json().get("paths", {}))

        docs_res = self.client.get("/api/docs/")
        self.assertEqual(docs_res.status_code, status.HTTP_200_OK)
        self.assertIn(b"swagger-ui", docs_res.content)

    def test_batch_edit_and_delete_protection(self):
        patch_res = self.client.patch(
            f"/admin/batches/{self.batch.id}/",
            {"batch_name": "Đợt Đã Đổi Tên"},
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.batch_name, "Đợt Đã Đổi Tên")

        # Has enrolled students -> protected unless force=true (409 Conflict)
        del_blocked = self.client.delete(f"/admin/batches/{self.batch.id}/")
        self.assertEqual(del_blocked.status_code, status.HTTP_409_CONFLICT)

        empty_batch = AcademicBatch.objects.create(batch_code="EMPTY", batch_name="Rỗng")
        del_ok = self.client.delete(f"/admin/batches/{empty_batch.id}/")
        self.assertIn(del_ok.status_code, (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT))

    def test_milestones_seed_crud_and_progress_sync(self):
        seed_res = self.client.post(f"/admin/batches/{self.batch.id}/milestones/seed-default/", {}, format="json")
        self.assertEqual(seed_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(seed_res.data), 6)

        # Duplicate seed without replace -> 409
        dup_res = self.client.post(f"/admin/batches/{self.batch.id}/milestones/seed-default/", {}, format="json")
        self.assertEqual(dup_res.status_code, status.HTTP_409_CONFLICT)

        # Create custom milestone & update it
        now = timezone.now()
        c_res = self.client.post(
            f"/admin/batches/{self.batch.id}/milestones/",
            {
                "name": "Mốc Nộp Bản Nháp Bổ Sung",
                "stage_number": 4,
                "start_date": (now - datetime.timedelta(days=1)).isoformat(),
                "end_date": (now + datetime.timedelta(days=5)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(c_res.status_code, status.HTTP_201_CREATED)
        ms_id = c_res.data["id"]

        upd = self.client.patch(f"/admin/milestones/{ms_id}/", {"name": "Mốc Đã Sửa"}, format="json")
        self.assertEqual(upd.status_code, status.HTTP_200_OK)
        self.assertEqual(upd.data["name"], "Mốc Đã Sửa")

        prog_res = self.client.get(f"/admin/batches/{self.batch.id}/progress/")
        self.assertEqual(prog_res.status_code, status.HTTP_200_OK)
        self.assertIn("milestones", prog_res.data)
        self.assertGreaterEqual(len(prog_res.data["milestones"]), 6)

        del_res = self.client.delete(f"/admin/milestones/{ms_id}/")
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)


class SupplementaryAndAcademicRecordTests(EnhancementsBaseTestCase):
    def setUp(self):
        super().setUp()
        SupervisorQuota.objects.create(batch=self.batch, supervisor=self.sup1, base_quota=3, max_total_quota=3)
        SupervisorQuota.objects.create(batch=self.batch, supervisor=self.sup2, base_quota=3, max_total_quota=3)
        # sv1 already assigned to sup1 with APPROVED outline -> MUST NEVER BE SCRAMBLED
        self.proj1 = GraduationProject.objects.create(
            student=self.sv1,
            supervisor=self.sup1,
            batch=self.batch,
            status="OUTLINE_APPROVED",
            topic_review_status="APPROVED",
            topic_title_vi="Đề tài đã ổn định của SV1",
        )
        # sv2 unassigned, prefers sup2
        StudentPreference.objects.create(
            student=self.sv2,
            batch=self.batch,
            topic_direction=self.topic_ai,
            preference_1=self.sup2,
        )
        InternshipInfo.objects.create(
            student=self.sv2,
            batch=self.batch,
            topic_direction=self.topic_ai,
            tentative_title="Đề tài AI SV2",
        )

    def test_supplementary_open_preserves_assigned_and_finalize_matches_unassigned(self):
        self.batch.current_stage = "PHASE_3_TOPIC"
        self.batch.save(update_fields=["current_stage"])

        open_res = self.client.post(f"/admin/batches/{self.batch.id}/supplementary/open/", {}, format="json")
        self.assertEqual(open_res.status_code, status.HTTP_200_OK)
        self.assertTrue(open_res.data["supplementary_open"])
        self.assertEqual(open_res.data["unassigned_count"], 1)

        # Notification sent only to sv2 (unassigned)
        self.assertTrue(Notification.objects.filter(user=self.sv2_user).exists())
        self.assertFalse(Notification.objects.filter(user=self.sv1_user).exists())

        # Blocking PHASE_5 transition & finalize_allocation while supplementary_open=True
        phase5_blocked = self.client.patch(
            f"/admin/batches/{self.batch.id}/",
            {"current_stage": "PHASE_5_IN_PROGRESS"},
            format="json",
        )
        self.assertEqual(phase5_blocked.status_code, status.HTTP_409_CONFLICT)

        fin_alloc_blocked = self.client.post(
            "/admin/allocations/finalize/",
            {"batch_id": self.batch.id},
            format="json",
        )
        self.assertEqual(fin_alloc_blocked.status_code, status.HTTP_400_BAD_REQUEST)

        # Finalize supplementary runs only_unassigned MCMF
        fin_res = self.client.post(
            f"/admin/batches/{self.batch.id}/supplementary/finalize/",
            {"run_auto_allocate": True},
            format="json",
        )
        self.assertEqual(fin_res.status_code, status.HTTP_200_OK)
        self.assertFalse(fin_res.data["supplementary_open"])
        self.batch.refresh_from_db()
        self.assertFalse(self.batch.supplementary_open)

        # sv1 still has exact original supervisor & status
        self.proj1.refresh_from_db()
        self.assertEqual(self.proj1.supervisor_id, self.sup1.id)
        self.assertEqual(self.proj1.status, "OUTLINE_APPROVED")

        # sv2 got assigned!
        proj2 = GraduationProject.objects.get(student=self.sv2)
        self.assertIsNotNone(proj2.supervisor_id)
        self.assertEqual(proj2.supervisor_id, self.sup2.id)

    def test_manual_academic_record_edit_and_admin_deferral(self):
        # Set low debt -> auto-evaluates ELIGIBLE & IN_PROGRESS
        edit_res = self.client.patch(
            f"/admin/projects/{self.proj1.id}/academic-record/",
            {"gpa_score": 3.25, "debt_credits": 4},
            format="json",
        )
        self.assertEqual(edit_res.status_code, status.HTTP_200_OK)
        self.proj1.refresh_from_db()
        self.assertEqual(self.proj1.gpa_score, 3.25)
        self.assertEqual(self.proj1.debt_credits, 4)
        self.assertEqual(self.proj1.initial_eligibility, "ELIGIBLE")
        self.assertEqual(self.proj1.status, "IN_PROGRESS")

        # Invalid GPA > 4.0 -> 400
        bad_gpa = self.client.patch(
            f"/admin/projects/{self.proj1.id}/academic-record/",
            {"gpa_score": 4.8},
            format="json",
        )
        self.assertEqual(bad_gpa.status_code, status.HTTP_400_BAD_REQUEST)

        # High debt -> auto INELIGIBLE & drops from IN_PROGRESS
        edit_bad = self.client.patch(
            f"/admin/projects/{self.proj1.id}/academic-record/",
            {"debt_credits": 12},
            format="json",
        )
        self.assertEqual(edit_bad.status_code, status.HTTP_200_OK)
        self.proj1.refresh_from_db()
        self.assertEqual(self.proj1.initial_eligibility, "INELIGIBLE")

        # Admin creates deferral on behalf of sv1 & auto-approves
        def_res = self.client.post(
            "/admin/deferrals/",
            {
                "project_id": self.proj1.id,
                "reason": "Khoa lập bảo lưu do SV nhập viện",
                "auto_approve": True,
            },
            format="json",
        )
        self.assertEqual(def_res.status_code, status.HTTP_201_CREATED)
        req = ThesisDeferralRequest.objects.get(id=def_res.data["deferral"]["id"])
        self.assertTrue(req.created_by_admin)
        self.assertEqual(req.status, "APPROVED")
        self.proj1.refresh_from_db()
        self.assertEqual(self.proj1.status, "DEFERRED")


class ManualDefenseSlotAndSignaturesTests(EnhancementsBaseTestCase):
    def setUp(self):
        super().setUp()
        self.council_users = [
            CustomUser.objects.create_user(username=f"cm_{i}", email=f"cm_{i}@utc.edu.vn", password="x", user_type="supervisor")
            for i in range(5)
        ]
        self.council1 = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=1,
            council_name="Hội đồng 1",
            defense_room="P301",
            session_date=datetime.date(2026, 12, 20),
            session_time="MORNING",
        )
        roles = ["CHAIR", "SECRETARY", "SECRETARY", "MEMBER", "MEMBER"]
        self.c1_members = [
            CouncilMember.objects.create(council=self.council1, user=u, role=r)
            for u, r in zip(self.council_users, roles)
        ]
        self.council2 = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=2,
            council_name="Hội đồng 2",
            defense_room="P302",
            session_date=datetime.date(2026, 12, 20),
            session_time="MORNING",
        )
        # Share one member (council_users[0]) with council2 to test lecturer time conflict!
        CouncilMember.objects.create(council=self.council2, user=self.council_users[0], role="CHAIR")

        self.proj1 = GraduationProject.objects.create(
            student=self.sv1, supervisor=self.sup1, batch=self.batch, council=self.council1, status="DEFENSE_READY"
        )
        self.proj2 = GraduationProject.objects.create(
            student=self.sv2, supervisor=self.sup2, batch=self.batch, council=self.council2, status="DEFENSE_READY"
        )

    def test_manual_slot_conflicts_reopen_and_signatures(self):
        # Create valid slot on council1
        s1_res = self.client.post(
            "/admin/defense/slots/",
            {
                "council": self.council1.id,
                "project": self.proj1.id,
                "slot_date": "2026-12-20",
                "start_time": "08:00",
                "end_time": "08:40",
                "room": "P301",
                "order_number": 1,
            },
            format="json",
        )
        self.assertEqual(s1_res.status_code, status.HTTP_201_CREATED)
        slot1_id = s1_res.data["id"]

        # Same room + overlapping time -> 400
        room_conflict = self.client.post(
            "/admin/defense/slots/",
            {
                "council": self.council2.id,
                "project": self.proj2.id,
                "slot_date": "2026-12-20",
                "start_time": "08:20",
                "end_time": "09:00",
                "room": "p301",
            },
            format="json",
        )
        self.assertEqual(room_conflict.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phòng", room_conflict.data["detail"].lower())

        # Different room, same shared council member + overlapping time -> 400
        member_conflict = self.client.post(
            "/admin/defense/slots/",
            {
                "council": self.council2.id,
                "project": self.proj2.id,
                "slot_date": "2026-12-20",
                "start_time": "08:20",
                "end_time": "09:00",
                "room": "P302",
            },
            format="json",
        )
        self.assertEqual(member_conflict.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("giảng viên", member_conflict.data["detail"].lower())

        # COI check: put sup1 into council2 -> block scheduling proj with sup1? Test sup2 in council2
        coi_proj_user = CustomUser.objects.create_user(username="sv3_coi", password="x", user_type="student")
        coi_sv = Student.objects.create(user=coi_proj_user, registration_no="20260099", academic_batch=self.batch)
        CouncilMember.objects.create(council=self.council2, user=self.sup2_user, supervisor=self.sup2, role="MEMBER")
        coi_proj = GraduationProject.objects.create(
            student=coi_sv, supervisor=self.sup2, batch=self.batch, council=self.council2, status="DEFENSE_READY"
        )
        coi_err = self.client.post(
            "/admin/defense/slots/",
            {
                "council": self.council2.id,
                "project": coi_proj.id,
                "slot_date": "2026-12-20",
                "start_time": "10:00",
                "end_time": "10:40",
                "room": "P302",
            },
            format="json",
        )
        self.assertEqual(coi_err.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("COI", coi_err.data["detail"])

        # Edit slot1 & delete slot1
        patch_slot = self.client.patch(f"/admin/defense/slots/{slot1_id}/", {"room": "P305"}, format="json")
        self.assertEqual(patch_slot.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_slot.data["room"], "P305")

        # Council Reopen & Notify
        self.council1.is_finalized = True
        self.council1.save(update_fields=["is_finalized"])
        reopen_res = self.client.post(
            f"/admin/councils/{self.council1.id}/reopen-and-notify/",
            {"reopen": True, "notify": True},
            format="json",
        )
        self.assertEqual(reopen_res.status_code, status.HTTP_200_OK)
        self.assertTrue(reopen_res.data["reopened"])
        self.council1.refresh_from_db()
        self.assertFalse(self.council1.is_finalized)
        self.assertGreaterEqual(reopen_res.data["notified_count"], 5)

        # Signatures check
        DefenseMinutesSignature.objects.create(council=self.council1, project=self.proj1, member=self.c1_members[0], signed_by=self.c1_members[0].user)
        sig_res = self.client.get(f"/admin/defense/councils/{self.council1.id}/signatures/")
        self.assertEqual(sig_res.status_code, status.HTTP_200_OK)
        self.assertEqual(sig_res.data["by_project"][str(self.proj1.id)]["signed_count"], 1)
        self.assertEqual(sig_res.data["by_project"][str(self.proj1.id)]["total_members"], 5)

        del_slot = self.client.delete(f"/admin/defense/slots/{slot1_id}/")
        self.assertEqual(del_slot.status_code, status.HTTP_200_OK)


class RealSecurityCenterAndTopicAreaTests(EnhancementsBaseTestCase):
    def test_tracked_session_revocation_and_dynamic_policy(self):
        anon = APIClient()
        login_res = anon.post(
            "/admin/login/",
            {"username": "enh_admin", "password": "AdminPass123!"},
            format="json",
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        access = login_res.data["access"]

        sess_log = UserSessionLog.objects.filter(user=self.admin, is_active=True).first()
        self.assertIsNotNone(sess_log)

        # Token works initially
        bearer_client = APIClient()
        bearer_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        sec_res = bearer_client.get("/admin/security-center/")
        self.assertEqual(sec_res.status_code, status.HTTP_200_OK)
        self.assertIn("active_sessions", sec_res.data)
        self.assertIn("policies", sec_res.data)
        self.assertIn("rbac_matrix", sec_res.data)
        self.assertFalse(sec_res.data["security_headers"]["hsts_production"])

        # Revoke session remotely
        rev_res = self.client.post(
            f"/admin/security-center/sessions/{sess_log.id}/revoke/",
            {"reason": "Kiểm thử thu hồi phiên"},
            format="json",
        )
        self.assertEqual(rev_res.status_code, status.HTTP_200_OK)

        # Same JWT access token must immediately fail with 401!
        after_revoke = bearer_client.get("/admin/security-center/")
        self.assertEqual(after_revoke.status_code, status.HTTP_401_UNAUTHORIZED)

        # Dynamic security policy: update max_login_attempts to 2
        pol_res = self.client.put(
            "/admin/security-center/policies/",
            {"policies": [{"policy_key": "max_login_attempts", "policy_value": "2"}]},
            format="json",
        )
        self.assertEqual(pol_res.status_code, status.HTTP_200_OK)
        self.assertEqual(SecurityPolicy.objects.get(policy_key="max_login_attempts").policy_value, "2")

        # 2 wrong attempts trigger 429 lockout
        r1 = anon.post("/admin/login/", {"username": "enh_admin", "password": "wrong1"}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_401_UNAUTHORIZED)
        r2 = anon.post("/admin/login/", {"username": "enh_admin", "password": "wrong2"}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_topic_area_crud_and_in_use_protection(self):
        # Create new area
        c_res = self.client.post(
            "/admin/topic-areas/",
            {"code": "BLOCKCHAIN", "name": "Blockchain & Fintech"},
            format="json",
        )
        self.assertEqual(c_res.status_code, status.HTTP_201_CREATED)
        area_id = c_res.data["id"]

        # Patch it
        p_res = self.client.patch(f"/admin/topic-areas/{area_id}/", {"name": "Chuỗi khối"}, format="json")
        self.assertEqual(p_res.status_code, status.HTTP_200_OK)
        self.assertEqual(p_res.data["name"], "Chuỗi khối")

        # Cannot delete self.topic_sw because sup1 uses it -> 409
        del_in_use = self.client.delete(f"/admin/topic-areas/{self.topic_sw.id}/")
        self.assertEqual(del_in_use.status_code, status.HTTP_409_CONFLICT)

        # Can delete unused area -> 200
        del_ok = self.client.delete(f"/admin/topic-areas/{area_id}/")
        self.assertEqual(del_ok.status_code, status.HTTP_200_OK)

        # Non-admin student forbidden -> 403
        stu_client = APIClient()
        stu_client.force_authenticate(user=self.sv1_user)
        forb = stu_client.post("/admin/topic-areas/", {"code": "X", "name": "Y"}, format="json")
        self.assertEqual(forb.status_code, status.HTTP_403_FORBIDDEN)


class MilestoneLifecycleAndTimezoneTests(EnhancementsBaseTestCase):
    def test_auto_seed_scales_proportionally_and_closed_guard(self):
        start_date = timezone.localdate() + datetime.timedelta(days=1)
        end_date = start_date + datetime.timedelta(days=120)
        res = self.client.post(
            "/admin/batches/",
            {
                "batch_code": "K65-AUTO",
                "batch_name": "Đợt Tự Động Seed",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        batch_id = res.data["id"]
        seeded = BatchMilestone.objects.filter(batch_id=batch_id).order_by("stage_number")
        self.assertEqual(seeded.count(), 6)
        self.assertEqual(timezone.localtime(seeded.first().start_date).date(), start_date)
        self.assertEqual(timezone.localtime(seeded.last().end_date).date(), end_date)
        seeded_list = list(seeded)
        for previous, following in zip(seeded_list, seeded_list[1:]):
            previous_end = timezone.localtime(previous.end_date).date()
            following_start = timezone.localtime(following.start_date).date()
            self.assertEqual(following_start, previous_end + datetime.timedelta(days=1))

        milestone_data = self.client.get(f"/admin/batches/{batch_id}/milestones/").data
        self.assertEqual(milestone_data[0]["status"], "UPCOMING")
        self.assertTrue(all(item["status"] == "UPCOMING" for item in milestone_data[1:]))

        # Invalid dates & invalid stage rejected
        bad_dates = self.client.post(
            f"/admin/batches/{batch_id}/milestones/",
            {
                "name": "Mốc lỗi ngày",
                "stage_number": 3,
                "start_date": "2026-10-10T08:00:00+07:00",
                "end_date": "2026-10-05T23:59:59+07:00",
            },
            format="json",
        )
        self.assertEqual(bad_dates.status_code, status.HTTP_400_BAD_REQUEST)

        bad_stage = self.client.post(
            f"/admin/batches/{batch_id}/milestones/",
            {"name": "GĐ lỗi", "stage_number": 7},
            format="json",
        )
        self.assertEqual(bad_stage.status_code, status.HTTP_400_BAD_REQUEST)

        # Closed batch rejects milestone CRUD & seed
        ms_id = seeded.first().id
        batch_obj = AcademicBatch.objects.get(pk=batch_id)
        batch_obj.is_closed = True
        batch_obj.save(update_fields=["is_closed"])

        self.assertEqual(
            self.client.post(f"/admin/batches/{batch_id}/milestones/", {"name": "Blocked", "stage_number": 2}, format="json").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.patch(f"/admin/milestones/{ms_id}/", {"name": "Blocked Edit"}, format="json").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(self.client.delete(f"/admin/milestones/{ms_id}/").status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.client.post(f"/admin/batches/{batch_id}/milestones/seed-default/", {"replace": True}, format="json").status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_progress_timezone_days_left_and_stage_priority(self):
        from app.services.batch_progress import compute_milestone_days_left, select_current_milestone

        today = timezone.localdate()
        tz = timezone.get_current_timezone()
        # 00:30 local time tomorrow == 17:30 UTC today (when TZ=Asia/Ho_Chi_Minh)
        tomorrow_early = timezone.make_aware(
            datetime.datetime.combine(today + datetime.timedelta(days=1), datetime.time(0, 30)),
            tz,
        )
        self.assertEqual(compute_milestone_days_left(tomorrow_early, today=today), 1)

        milestones = [
            {"id": 1, "stage_number": 2, "status": "ACTIVE", "days_left": 5},
            {"id": 2, "stage_number": 4, "status": "UPCOMING", "days_left": 10},
            {"id": 3, "stage_number": 4, "status": "ACTIVE", "days_left": 7},
        ]
        chosen = select_current_milestone(milestones, current_number=4, is_closed=False)
        self.assertEqual(chosen["id"], 3)

    def test_batch_creation_rejects_missing_past_and_short_schedule(self):
        today = timezone.localdate()
        common = {"batch_name": "Đợt kiểm tra lịch", "program_type": "BACHELOR"}

        missing = self.client.post(
            "/admin/batches/",
            {**common, "batch_code": "DATE-MISSING"},
            format="json",
        )
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("start_date", missing.data)
        self.assertIn("end_date", missing.data)

        past = self.client.post(
            "/admin/batches/",
            {
                **common,
                "batch_code": "DATE-PAST",
                "start_date": (today - datetime.timedelta(days=1)).isoformat(),
                "end_date": (today + datetime.timedelta(days=60)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(past.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("start_date", past.data)

        too_short = self.client.post(
            "/admin/batches/",
            {
                **common,
                "batch_code": "DATE-SHORT",
                "start_date": today.isoformat(),
                "end_date": (today + datetime.timedelta(days=49)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(too_short.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end_date", too_short.data)

        valid = self.client.post(
            "/admin/batches/",
            {
                **common,
                "batch_code": "DATE-VALID",
                "start_date": today.isoformat(),
                "end_date": (today + datetime.timedelta(days=50)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(valid.status_code, status.HTTP_201_CREATED)
        statuses = list(
            BatchMilestone.objects.filter(batch_id=valid.data["id"])
            .order_by("stage_number")
            .values_list("stage_number", flat=True)
        )
        self.assertEqual(statuses, [1, 2, 3, 4, 5, 6])
        serialized = self.client.get(f"/admin/batches/{valid.data['id']}/milestones/").data
        self.assertIn(serialized[0]["status"], ("UPCOMING", "ACTIVE"))
        self.assertTrue(all(item["status"] == "UPCOMING" for item in serialized[1:]))


class StageDeadlineEnforcementTests(EnhancementsBaseTestCase):
    def _make_student(self, code, batch):
        user = CustomUser.objects.create_user(
            username=f"sd_{code}",
            email=f"sd_{code}@utc.edu.vn",
            password="Password123!",
            first_name=code,
            last_name="Sinh Viên",
            user_type="student",
        )
        return Student.objects.create(user=user, registration_no=f"SD{code}", academic_batch=batch)

    def test_preview_and_enforce_g2_to_g5_deadlines_and_exemptions(self):
        from django.core.management import call_command
        from app.feature_models import SubmissionVersion
        from app.models import Notification
        from app.tasks import enforce_stage_deadlines_task

        now = timezone.now()
        past_end = now - datetime.timedelta(hours=3)
        future_end = now + datetime.timedelta(days=5)
        start_past = now - datetime.timedelta(days=20)

        batch = AcademicBatch.objects.create(
            batch_code="K65-ENF",
            batch_name="Đợt Quá Hạn",
            current_stage="PHASE_4_ELIGIBILITY",
            is_active=True,
            is_closed=False,
        )
        # GĐ1 & GĐ6 expired milestones MUST be ignored
        BatchMilestone.objects.create(
            batch=batch, name="GĐ1", stage_number=1, start_date=start_past, end_date=past_end, order_index=1, is_active=True
        )
        # GĐ2 expired, GĐ3 has one past + one still future -> GĐ3 NOT expired yet!
        BatchMilestone.objects.create(
            batch=batch, name="GĐ2 Phân công", stage_number=2, start_date=start_past, end_date=past_end, order_index=2, is_active=True
        )
        BatchMilestone.objects.create(
            batch=batch, name="GĐ3 Đợt 1", stage_number=3, start_date=start_past, end_date=past_end, order_index=3, is_active=True
        )
        BatchMilestone.objects.create(
            batch=batch, name="GĐ3 Đợt 2", stage_number=3, start_date=start_past, end_date=future_end, order_index=4, is_active=True
        )
        BatchMilestone.objects.create(
            batch=batch, name="GĐ4 Bản nháp & ĐK", stage_number=4, start_date=start_past, end_date=past_end, order_index=5, is_active=True
        )

        sv_unassigned = self._make_student("01", batch)
        sv_outline_ok_but_no_draft = self._make_student("02", batch)
        sv_ineligible = self._make_student("03", batch)
        sv_draft_ok = self._make_student("04", batch)
        sv_forced = self._make_student("05", batch)
        sv_deferred = self._make_student("06", batch)

        p_no_draft = GraduationProject.objects.create(
            student=sv_outline_ok_but_no_draft, supervisor=self.sup1, batch=batch,
            status="OUTLINE_APPROVED", topic_review_status="APPROVED", initial_eligibility="ELIGIBLE"
        )
        p_inelig = GraduationProject.objects.create(
            student=sv_ineligible, supervisor=self.sup1, batch=batch,
            status="OUTLINE_APPROVED", topic_review_status="APPROVED", initial_eligibility="INELIGIBLE"
        )
        p_draft_ok = GraduationProject.objects.create(
            student=sv_draft_ok, supervisor=self.sup1, batch=batch,
            status="OUTLINE_APPROVED", topic_review_status="APPROVED", initial_eligibility="ELIGIBLE"
        )
        SubmissionVersion.objects.create(
            project=p_draft_ok, uploaded_by=sv_draft_ok.user, kind="REPORT",
            version_no=1, file="/tmp/draft.pdf", supervisor_review_status="APPROVED"
        )
        p_forced = GraduationProject.objects.create(
            student=sv_forced, supervisor=self.sup1, batch=batch,
            status="IN_PROGRESS", topic_review_status="APPROVED", initial_eligibility="FORCE_APPROVED", is_force_approved=True
        )
        p_deferred = GraduationProject.objects.create(
            student=sv_deferred, supervisor=self.sup1, batch=batch,
            status="DEFERRED", deferral_status="APPROVED"
        )

        # Preview (dry-run) must NOT mutate DB
        prev = self.client.get(f"/admin/batches/{batch.id}/enforce-deadlines/")
        self.assertEqual(prev.status_code, status.HTTP_200_OK)
        self.assertEqual([s["stage_number"] for s in prev.data["expired_stages"]], [2, 4])
        self.assertEqual(prev.data["candidate_count"], 3)
        sv_unassigned.refresh_from_db()
        self.assertEqual(sv_unassigned.academic_batch_id, batch.id)

        # Execute via API
        exec_res = self.client.post(f"/admin/batches/{batch.id}/enforce-deadlines/", {}, format="json")
        self.assertEqual(exec_res.status_code, status.HTTP_200_OK)
        self.assertEqual(exec_res.data["removed_count"], 3)

        sv_unassigned.refresh_from_db()
        sv_outline_ok_but_no_draft.refresh_from_db()
        sv_ineligible.refresh_from_db()
        sv_draft_ok.refresh_from_db()
        sv_forced.refresh_from_db()
        sv_deferred.refresh_from_db()
        p_no_draft.refresh_from_db()
        p_inelig.refresh_from_db()

        self.assertIsNone(sv_unassigned.academic_batch_id)
        self.assertIsNone(sv_outline_ok_but_no_draft.academic_batch_id)
        self.assertIsNone(sv_ineligible.academic_batch_id)
        self.assertEqual(p_no_draft.status, "DISQUALIFIED")
        self.assertEqual(p_no_draft.initial_eligibility, "DISQUALIFIED")
        self.assertEqual(p_inelig.status, "DISQUALIFIED")

        # Compliant & exempt students kept intact
        self.assertEqual(sv_draft_ok.academic_batch_id, batch.id)
        self.assertEqual(sv_forced.academic_batch_id, batch.id)
        self.assertEqual(sv_deferred.academic_batch_id, batch.id)
        self.assertTrue(Notification.objects.filter(user=sv_unassigned.user, title__startswith="[Loại khỏi đợt K65-ENF]").exists())

        # Now expire GĐ3 + GĐ5 + GĐ6 -> advance batch to GĐ5 & test GĐ5 + GĐ6 guard
        BatchMilestone.objects.filter(batch=batch, stage_number=3).update(end_date=past_end)
        batch.current_stage = "PHASE_6_DEFENSE"
        batch.save(update_fields=["current_stage"])
        BatchMilestone.objects.create(
            batch=batch, name="GĐ5", stage_number=5, start_date=start_past, end_date=past_end, order_index=6, is_active=True
        )
        BatchMilestone.objects.create(
            batch=batch, name="GĐ6", stage_number=6, start_date=start_past, end_date=past_end, order_index=7, is_active=True
        )
        p_draft_ok.status = "IN_PROGRESS"
        p_draft_ok.save(update_fields=["status"])
        p_forced.is_eligible_for_defense = True
        p_forced.status = "DEFENSE_READY"
        p_forced.save(update_fields=["is_eligible_for_defense", "status"])

        summary = enforce_stage_deadlines_task()
        self.assertGreaterEqual(summary["total_removed"], 1)
        sv_draft_ok.refresh_from_db()
        sv_forced.refresh_from_db()
        self.assertIsNone(sv_draft_ok.academic_batch_id)  # Failed GĐ5
        self.assertEqual(sv_forced.academic_batch_id, batch.id)  # Ready for GĐ6, never expelled at GĐ6!

        # Closed batch rejects POST enforce-deadlines & management command works cleanly
        call_command("enforce_stage_deadlines", batch_id=batch.id, dry_run=True)
        batch.is_closed = True
        batch.save(update_fields=["is_closed"])
        closed_res = self.client.post(f"/admin/batches/{batch.id}/enforce-deadlines/", {}, format="json")
        self.assertEqual(closed_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_auto_enforce_on_finalize_and_advance_to_stage5(self):
        from app.feature_models import SubmissionVersion

        now = timezone.now()
        past_end = now - datetime.timedelta(hours=2)
        batch = AcademicBatch.objects.create(
            batch_code="K65-TRN",
            batch_name="Đợt Chuyển GĐ",
            current_stage="PHASE_2_ALLOCATING",
            is_active=True,
            is_closed=False,
        )
        BatchMilestone.objects.create(
            batch=batch, name="GĐ2 Hết Hạn", stage_number=2, start_date=now - datetime.timedelta(days=10), end_date=past_end, order_index=1, is_active=True
        )
        sv_ok = self._make_student("11", batch)
        sv_lazy = self._make_student("12", batch)
        p_ok = GraduationProject.objects.create(
            student=sv_ok, supervisor=self.sup1, batch=batch,
            status="OUTLINE_APPROVED", topic_review_status="APPROVED", initial_eligibility="ELIGIBLE"
        )
        SubmissionVersion.objects.create(
            project=p_ok, uploaded_by=sv_ok.user, kind="REPORT",
            version_no=1, file="/tmp/ok.pdf", supervisor_review_status="APPROVED"
        )

        # Finalize GĐ2 succeeds by auto-removing sv_lazy
        fin_res = self.client.post("/admin/allocations/finalize/", {"batch_id": batch.id}, format="json")
        self.assertEqual(fin_res.status_code, status.HTTP_200_OK)
        sv_lazy.refresh_from_db()
        self.assertIsNone(sv_lazy.academic_batch_id)

        # Advance to GĐ5 when GĐ4 expired auto-removes sv_late_g4 so remaining draft-ok cohort succeeds
        batch.current_stage = "PHASE_4_ELIGIBILITY"
        batch.save(update_fields=["current_stage"])
        BatchMilestone.objects.create(
            batch=batch, name="GĐ4 Hết Hạn", stage_number=4, start_date=now - datetime.timedelta(days=5), end_date=past_end, order_index=2, is_active=True
        )
        sv_late_g4 = self._make_student("13", batch)
        p_late_g4 = GraduationProject.objects.create(
            student=sv_late_g4, supervisor=self.sup1, batch=batch,
            status="OUTLINE_APPROVED", topic_review_status="APPROVED", initial_eligibility="ELIGIBLE"
        )

        adv_res = self.client.patch(
            f"/admin/batches/{batch.id}/", {"current_stage": "PHASE_5_IN_PROGRESS"}, format="json"
        )
        self.assertEqual(adv_res.status_code, status.HTTP_200_OK)
        sv_late_g4.refresh_from_db()
        p_late_g4.refresh_from_db()
        self.assertIsNone(sv_late_g4.academic_batch_id)
        self.assertEqual(p_late_g4.status, "DISQUALIFIED")
