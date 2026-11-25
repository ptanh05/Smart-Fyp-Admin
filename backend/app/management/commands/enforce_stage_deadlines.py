from django.core.management.base import BaseCommand

from app.models import AcademicBatch
from app.services.stage_deadline_enforcement import (
    enforce_all_active_batches_stage_deadlines,
    enforce_batch_stage_deadlines,
)


class Command(BaseCommand):
    help = "Kiểm tra và loại sinh viên chưa hoàn thành ở các giai đoạn GĐ2–GĐ5 đã quá hạn mốc thời gian."

    def add_arguments(self, parser):
        parser.add_argument("--batch-id", type=int, help="Chỉ xử lý một đợt đồ án cụ thể theo ID.")
        parser.add_argument("--dry-run", action="store_true", help="Chỉ xem trước danh sách sẽ bị loại, không ghi DB.")

    def handle(self, *args, **options):
        batch_id = options.get("batch_id")
        dry_run = bool(options.get("dry_run"))

        if batch_id:
            batch = AcademicBatch.objects.filter(pk=batch_id).first()
            if not batch:
                self.stderr.write(self.style.ERROR(f"Không tìm thấy đợt #{batch_id}."))
                return
            res = enforce_batch_stage_deadlines(batch, dry_run=dry_run)
            self.stdout.write(
                f"Đợt {batch.batch_code}: ứng viên={res['candidate_count']}, đã loại={res['removed_count']} (dry_run={dry_run})."
            )
            return

        summary = enforce_all_active_batches_stage_deadlines(dry_run=dry_run)
        self.stdout.write(
            f"Đã quét {summary['scanned_batches']} đợt: tổng loại={summary['total_removed']} (dry_run={dry_run})."
        )
