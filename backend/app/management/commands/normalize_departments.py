# -*- coding: utf-8 -*-
from django.core.management.base import BaseCommand
from app.utils.department_formatter import auto_heal_unaccented_departments

class Command(BaseCommand):
    help = "Chuẩn hóa tên Bộ môn và giảng viên sang tiếng Việt có dấu chuẩn UTC"

    def handle(self, *args, **options):
        self.stdout.write("Đang chuẩn hóa tên Bộ môn và giảng viên...")
        auto_heal_unaccented_departments()
        self.stdout.write(self.style.SUCCESS("[OK] Da chuan hoa toan bo Bo mon va giang vien sang tieng Viet co dau!"))
