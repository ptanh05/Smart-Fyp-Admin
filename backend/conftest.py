"""
Pytest root conftest for Smart-Fyp-Admin backend.

Creates unmanaged (managed=False) model tables in the SQLite test DB so that
feature-view tests can query them.  pytest-django does not use Django's
TEST_RUNNER, so LegacyTableTestRunner never fires; we replicate its logic here.
"""
import pytest


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):  # noqa: F811
    """After Django builds the test DB, create any missing unmanaged tables."""
    with django_db_blocker.unblock():
        _create_missing_unmanaged_tables()


def _create_missing_unmanaged_tables():
    from django.apps import apps
    from django.db import connection

    existing_tables = set(connection.introspection.table_names())

    with connection.schema_editor() as editor:
        for model in apps.get_models():
            meta = model._meta
            if meta.managed:
                continue
            table_name = meta.db_table
            if not table_name or table_name in existing_tables:
                continue

            # Temporarily disable db_constraint to avoid FK issues in SQLite
            patched = []
            for field in meta.local_fields:
                if getattr(field, "db_constraint", False):
                    field.db_constraint = False
                    patched.append(field)

            try:
                editor.create_model(model)
                existing_tables.add(table_name)
            except Exception:
                pass  # table already exists or can't be created — skip
            finally:
                for field in patched:
                    field.db_constraint = True
