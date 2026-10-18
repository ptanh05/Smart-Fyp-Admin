import logging
from django.db import connection, transaction, IntegrityError
from app.models import CustomUser

logger = logging.getLogger(__name__)


def fix_all_postgres_sequences():
    """
    Reset and synchronize all PostgreSQL primary key sequences with MAX(id).
    Uses Django's official DatabaseOperations.sequence_reset_sql.
    """
    if connection.vendor != 'postgresql':
        return

    try:
        from django.apps import apps
        from django.core.management.color import no_style

        app_models = apps.get_app_config('app').get_models()
        statements = connection.ops.sequence_reset_sql(no_style(), app_models)
        with connection.cursor() as cursor:
            for sql in statements:
                try:
                    cursor.execute(sql)
                except Exception as ex:
                    logger.debug(f"Sequence reset skipped for statement: {ex}")
        logger.info("Successfully synchronized PostgreSQL sequences for all app models.")
    except Exception as e:
        logger.warning(f"Failed to synchronize PostgreSQL sequences: {e}")


def safe_create_user(username, email, password, **kwargs):
    """
    Create a CustomUser safely, automatically fixing PostgreSQL sequence desync
    if an IntegrityError on primary key is encountered.
    """
    # Ensure first_name and last_name are not None to satisfy NOT NULL constraints
    kwargs.setdefault('first_name', '')
    kwargs.setdefault('last_name', '')

    try:
        with transaction.atomic():
            return CustomUser.objects.create_user(
                username=username,
                email=email,
                password=password,
                **kwargs
            )
    except IntegrityError as e:
        err_str = str(e).lower()
        if "pkey" in err_str or "duplicate key" in err_str or "unique constraint" in err_str:
            logger.warning(
                f"Sequence desynchronization or PK conflict detected for '{username}': {e}. Auto-repairing sequences..."
            )
            fix_all_postgres_sequences()
            # Retry creation once with fresh sequence value in a separate atomic savepoint
            with transaction.atomic():
                return CustomUser.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    **kwargs
                )
        raise
