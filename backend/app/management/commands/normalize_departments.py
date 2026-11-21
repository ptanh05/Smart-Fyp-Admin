# -*- coding: utf-8 -*-
from django.core.management.base import BaseCommand
from app.utils.department_formatter import auto_heal_unaccented_departments

class Command(BaseCommand):
    help = "Chuan hoa ten Bo mon va giang vien sang tieng Viet co dau chuan UTC"

    def handle(self, *args, **options):
        self.stdout.write("Dang chuan hoa ten Bo mon va giang vien...")
        auto_heal_unaccented_departments()
        self.stdout.write(self.style.SUCCESS("[OK] Da chuan hoa toan bo Bo mon va giang vien sang tieng Viet co dau!"))
