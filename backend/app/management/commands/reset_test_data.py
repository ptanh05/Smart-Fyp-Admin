import csv
import io
import json
import os
import zipfile
from datetime import datetime

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction


PRESERVED_APP_TABLES = {
    "app_customuser",
    "app_customuser_groups",
    "app_customuser_user_permissions",
    "app_supervisor",
    "app_department",
    "app_projecttopicarea",
    "app_supervisortopicarea",
    "app_supervisor_category",
    "app_academicstaff",
}


class Command(BaseCommand):
    help = "Backup PostgreSQL rồi đưa dữ liệu nghiệp vụ về trạng thái mới, giữ giảng viên và danh mục nền."

    def add_arguments(self, parser):
        parser.add_argument("--execute", action="store_true", help="Thực sự dọn dữ liệu; mặc định chỉ dry-run.")

    def _public_tables(self, cursor):
        cursor.execute(
            """
            SELECT tablename
            FROM pg_catalog.pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
            """
        )
        return [row[0] for row in cursor.fetchall()]

    def _backup(self, cursor, tables):
        backup_dir = os.path.join(settings.BASE_DIR, "backups")
        os.makedirs(backup_dir, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(backup_dir, f"pre_fresh_test_postgres_{stamp}.zip")
        qn = connection.ops.quote_name
        manifest = {"created_at": datetime.now().isoformat(), "database_vendor": connection.vendor, "tables": {}}

        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for table in tables:
                cursor.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = %s
                    ORDER BY ordinal_position
                    """,
                    [table],
                )
                columns = [row[0] for row in cursor.fetchall()]
                cursor.execute(f"SELECT COUNT(*) FROM {qn(table)}")
                count = cursor.fetchone()[0]

                stream = io.StringIO(newline="")
                writer = csv.writer(stream)
                writer.writerow(columns)
                cursor.execute(f"SELECT * FROM {qn(table)}")
                while True:
                    rows = cursor.fetchmany(1000)
                    if not rows:
                        break
                    writer.writerows(rows)
                archive.writestr(f"tables/{table}.csv", stream.getvalue().encode("utf-8"))
                manifest["tables"][table] = {"rows": count, "columns": columns}

            archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"))

        if not os.path.exists(path) or os.path.getsize(path) == 0:
            raise CommandError("Backup không được tạo thành công; hủy dọn dữ liệu.")
        with zipfile.ZipFile(path, "r") as archive:
            bad_file = archive.testzip()
            if bad_file:
                raise CommandError(f"Backup ZIP lỗi tại {bad_file}; hủy dọn dữ liệu.")
        return path

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError("Command này chỉ dành cho PostgreSQL.")

        with connection.cursor() as cursor:
            tables = self._public_tables(cursor)
            app_tables = [table for table in tables if table.startswith("app_")]
            purge_tables = [table for table in app_tables if table not in PRESERVED_APP_TABLES]
            cursor.execute("SELECT COUNT(*) FROM app_customuser WHERE user_type = 'student'")
            student_users = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM app_supervisor")
            supervisors = cursor.fetchone()[0]

        self.stdout.write(f"Giữ lại {supervisors} giảng viên và các bảng: {', '.join(sorted(PRESERVED_APP_TABLES))}")
        self.stdout.write(f"Sẽ xóa {student_users} tài khoản sinh viên và làm trống {len(purge_tables)} bảng nghiệp vụ.")
        for table in purge_tables:
            self.stdout.write(f"  - {table}")

        if not options["execute"]:
            self.stdout.write(self.style.WARNING("DRY-RUN: chưa thay đổi database. Dùng --execute để thực thi."))
            return

        with connection.cursor() as cursor:
            backup_path = self._backup(cursor, tables)
        self.stdout.write(self.style.SUCCESS(f"Backup hợp lệ: {backup_path}"))

        qn = connection.ops.quote_name
        with transaction.atomic():
            with connection.cursor() as cursor:
                if purge_tables:
                    table_sql = ", ".join(qn(table) for table in purge_tables)
                    cursor.execute(f"TRUNCATE TABLE {table_sql} RESTART IDENTITY CASCADE")

                # Xóa toàn bộ phiên và JWT cũ để không giữ session trỏ tới dữ liệu đã dọn.
                for table in [
                    "token_blacklist_blacklistedtoken",
                    "token_blacklist_outstandingtoken",
                    "django_session",
                ]:
                    if table in tables:
                        cursor.execute(f"TRUNCATE TABLE {qn(table)} RESTART IDENTITY CASCADE")

                cursor.execute("DELETE FROM app_customuser WHERE user_type = 'student'")

        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM app_customuser WHERE user_type = 'student'")
            remaining_students = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM app_supervisor")
            remaining_supervisors = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM app_academicbatch")
            remaining_batches = cursor.fetchone()[0]

        self.stdout.write(self.style.SUCCESS("Dọn dữ liệu hoàn tất."))
        self.stdout.write(f"  - Sinh viên còn lại: {remaining_students}")
        self.stdout.write(f"  - Giảng viên còn lại: {remaining_supervisors}")
        self.stdout.write(f"  - Đợt ĐATN còn lại: {remaining_batches}")
