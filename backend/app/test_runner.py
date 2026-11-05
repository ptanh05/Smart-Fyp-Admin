"""
Custom Django test runner cho Smart-Fyp-Admin.

Một số model tương thích (unmanaged) trong `app/models.py` trỏ tới các bảng
legacy đã tồn tại sẵn trên production (Neon PostgreSQL), ví dụ:
`app_group`, `app_document`, `app_supervisorofstudentgroup`.

Khi chạy test với SQLite, Django KHÔNG tạo bảng cho model unmanaged ->
test chạm vào những model này sẽ fail với `no such table`. Test runner này
tự tạo các bảng còn thiếu sau khi Django dựng xong test database.

Các bảng legacy được tạo KHÔNG kèm ràng buộc khóa ngoại (`db_constraint=False`)
vì chúng dùng `on_delete=DO_NOTHING` tới bảng được quản lý, nên khi test xoá
user sẽ tạo dòng orphan và `PRAGMA foreign_key_check` báo IntegrityError.
"""
from django.db import connection
from django.test.runner import DiscoverRunner


class LegacyTableTestRunner(DiscoverRunner):
    """DiscoverRunner + tự tạo bảng cho các model unmanaged bị thiếu."""

    def setup_databases(self, **kwargs):
        result = super().setup_databases(**kwargs)
        self._create_missing_legacy_tables()
        return result

    # ------------------------------------------------------------------
    def _create_missing_legacy_tables(self):
        from django.apps import apps

        existing_tables = set(connection.introspection.table_names())

        with connection.schema_editor() as schema_editor:
            for model in apps.get_models():
                meta = model._meta
                if meta.managed:
                    continue
                table_name = meta.db_table
                if not table_name or table_name in existing_tables:
                    continue

                patched = []
                for field in meta.local_fields:
                    if getattr(field, "db_constraint", False):
                        field.db_constraint = False
                        patched.append(field)

                try:
                    schema_editor.create_model(model)
                    existing_tables.add(table_name)
                except Exception:
                    # Bảng đã tồn tại hoặc không tạo được -> bỏ qua, không chặn test.
                    pass
                finally:
                    for field in patched:
                        field.db_constraint = True
