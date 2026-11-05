"""
Đồng bộ trạng thái kho lưu trữ của các Đợt đồ án (GĐ1 Admin).

Vấn đề: nhiều đợt cũ trong DB có is_closed=True nhưng is_active vẫn còn True.
Client portal & Admin backend đều tìm "đợt đang hoạt động" bằng is_active=True
nên có thể chọn nhầm một đợt đã kết thúc.

Lệnh này:
1. Chuẩn hóa mọi đợt đã khóa sổ (is_closed=True hoặc stage=COMPLETED) về
   is_active=False, current_stage=COMPLETED.
2. Chuẩn hóa mọi đợt đang mở về is_active=True, is_closed=False.
3. Tùy chọn --reopen-offICIAL: mở lại đợt chính thức (theo batch_code chỉ định)
   để phục vụ demo/kịch bản kiểm thử.

Cách dùng:
    python manage.py sync_batch_state
    python manage.py sync_batch_state --reopen-official K62_HK1_2026_2027
    python manage.py sync_batch_state --dry-run
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from app.models import AcademicBatch


class Command(BaseCommand):
    help = "Đồng bộ trạng thái is_active / is_closed / current_stage cho các Đợt đồ án."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reopen-official",
            dest="reopen_official",
            default=None,
            help="Mã đợt chính thức cần mở lại (VD: K62_HK1_2026_2027).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            dest="dry_run",
            help="Chỉ hiển thị thay đổi, không ghi vào database.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        reopen_code = options["reopen_official"]

        if reopen_code:
            batch = AcademicBatch.objects.filter(batch_code=reopen_code).first()
            if not batch:
                self.stderr.write(self.style.ERROR(f"Không tìm thấy đợt có mã '{reopen_code}'."))
                return
            batch.is_closed = False
            batch.is_active = True
            if batch.current_stage == "COMPLETED":
                batch.current_stage = "PHASE_5_IN_PROGRESS"
            batch.save(update_fields=["is_closed", "is_active", "current_stage"])
            if not dry_run:
                batch.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f"{'[DRY-RUN] ' if dry_run else ''}Đã mở lại đợt '{batch.batch_code}' "
                    f"(id={batch.id}) -> stage={batch.current_stage}"
                )
            )

        fixed = 0
        for batch in AcademicBatch.objects.all():
            should_close = batch.is_closed or batch.current_stage == "COMPLETED"
            if should_close:
                new_active, new_closed, new_stage = False, True, "COMPLETED"
            else:
                new_active, new_closed, new_stage = True, False, batch.current_stage

            if (batch.is_active, batch.is_closed, batch.current_stage) == (
                new_active,
                new_closed,
                new_stage,
            ):
                continue

            self.stdout.write(
                f"{'[DRY-RUN] ' if dry_run else ''}id={batch.id} '{batch.batch_code}': "
                f"active {batch.is_active}->{new_active}, closed {batch.is_closed}->{new_closed}, "
                f"stage {batch.current_stage}->{new_stage}"
            )
            batch.is_active = new_active
            batch.is_closed = new_closed
            batch.current_stage = new_stage
            if not dry_run:
                batch.save(update_fields=["is_active", "is_closed", "current_stage"])
            fixed += 1

        verb = "Sẽ chuẩn hóa" if dry_run else "Đã chuẩn hóa"
        self.stdout.write(self.style.SUCCESS(f"{verb} {fixed} đợt đồ án."))

        active = AcademicBatch.get_active_batch()
        if active:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Đợt đang hoạt động hiện tại: '{active.batch_code}' (id={active.id}) - {active.current_stage}"
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING("Hiện KHÔNG có đợt đồ án nào đang hoạt động.")
            )
