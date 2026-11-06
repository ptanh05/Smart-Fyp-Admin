"""
Bảo đảm lệnh `seed_admin_data` KHÔNG tạo lại tài khoản giảng viên demo và
KHÔNG xóa mất danh sách giảng viên chính thức (UTC001..UTC033).

Bối cảnh:
    Hai backend Django (smart-fyp-management và Smart-Fyp-Admin) dùng chung một
    database Neon. Lệnh `seed_admin_data` chạy trong buildCommand của Render
    nên mỗi lần deploy đều tạo lại 5 tài khoản GV demo
    (gv_nguyenvana, gv_tranthib, gv_levanc, gv_phamminhd, gv_hoangvanh).
    Sau khi các tài khoản demo bị gỡ khỏi DB, lệnh phải:
      1. KHÔNG tạo lại tài khoản demo.
      2. Tái sử dụng các GV chính thức đã có sẵn trong DB.
      3. Với `--reset`, KHÔNG xóa mất hồ sơ GV chính thức.
"""

from django.core.management import call_command
from django.test import TestCase

from app.models import (
    CouncilMember,
    CustomUser,
    GraduationProject,
    Supervisor,
    SupervisorQuota,
)

DEMO_USERNAMES = [
    "gv_nguyenvana",
    "gv_tranthib",
    "gv_levanc",
    "gv_phamminhd",
    "gv_hoangvanh",
]

OFFICIAL_USERNAMES = [
    "gv_tran_thi_ngan",
    "gv_nguyen_van_long",
    "gv_bui_ngoc_dung",
    "gv_cao_thi_luyen",
    "gv_ao_thi_le_thuy",
]


class SeedAdminDataOfficialSupervisorTests(TestCase):
    def _make_official_supervisors(self):
        """Tạo 5 GV chính thức UTC001..UTC005 giống hệt DB thật."""
        created = []
        for idx, username in enumerate(OFFICIAL_USERNAMES, start=1):
            user = CustomUser.objects.create_user(
                username=username,
                email=f"{username.replace('gv_', '')}@utc.edu.vn",
                password="Gv@123456",
                user_type="supervisor",
            )
            sup = Supervisor.objects.create(
                user=user,
                supervisor_id=f"UTC{idx:03d}",
                academic_title="TS",
                department_name="Khoa CNTT",
                academic_rank_multiplier=1.2,
                is_active=True,
            )
            created.append((user, sup))
        return created

    def test_seed_does_not_create_demo_supervisor_accounts(self):
        self._make_official_supervisors()

        call_command("seed_admin_data")

        self.assertFalse(
            CustomUser.objects.filter(username__in=DEMO_USERNAMES).exists(),
            "seed_admin_data đã tạo lại tài khoản giảng viên demo.",
        )
        self.assertFalse(
            Supervisor.objects.filter(
                user__username__in=DEMO_USERNAMES
            ).exists(),
            "seed_admin_data đã tạo lại hồ sơ giảng viên demo.",
        )

    def test_seed_reuses_existing_official_supervisors(self):
        self._make_official_supervisors()

        call_command("seed_admin_data")

        # Không tạo user mới cho GV chính thức (vẫn đúng 5 user gv_*).
        for username in OFFICIAL_USERNAMES:
            self.assertEqual(
                CustomUser.objects.filter(username=username).count(),
                1,
                f"{username} bị tạo trùng.",
            )

        # Hội đồng phải dùng GV chính thức, không dùng GV demo.
        council_users = set(
            CouncilMember.objects.values_list("user__username", flat=True)
        )
        self.assertFalse(
            council_users & set(DEMO_USERNAMES),
            "Hội đồng vẫn trỏ tới giảng viên demo.",
        )

    def test_seed_is_idempotent(self):
        self._make_official_supervisors()

        call_command("seed_admin_data")
        counts_first = (
            CustomUser.objects.count(),
            Supervisor.objects.count(),
            SupervisorQuota.objects.count(),
            GraduationProject.objects.count(),
        )

        call_command("seed_admin_data")
        counts_second = (
            CustomUser.objects.count(),
            Supervisor.objects.count(),
            SupervisorQuota.objects.count(),
            GraduationProject.objects.count(),
        )

        self.assertEqual(counts_first, counts_second)

    def test_reset_keeps_official_supervisors(self):
        self._make_official_supervisors()

        call_command("seed_admin_data", reset=True)

        self.assertEqual(
            Supervisor.objects.filter(
                supervisor_id__startswith="UTC"
            ).count(),
            5,
            "--reset đã xóa mất hồ sơ giảng viên chính thức UTC001..UTC005.",
        )
        for username in OFFICIAL_USERNAMES:
            self.assertTrue(
                CustomUser.objects.filter(username=username).exists(),
                f"--reset đã xóa mất user giảng viên chính thức {username}.",
            )
        self.assertFalse(
            CustomUser.objects.filter(username__in=DEMO_USERNAMES).exists(),
            "--reset vẫn để lại tài khoản giảng viên demo.",
        )
