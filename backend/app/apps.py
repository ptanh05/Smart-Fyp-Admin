import sys
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)

class AppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'app'

    def ready(self):
        # Prevent executing during migration, test, or collectstatic commands
        skip_cmds = ['migrate', 'makemigrations', 'collectstatic', 'test', 'check']
        if any(cmd in sys.argv for cmd in skip_cmds):
            return

        try:
            from django.db import connection
            # Check if CustomUser table is already migrated
            all_tables = connection.introspection.table_names()
            if 'app_customuser' in all_tables:
                from app.models import CustomUser
                # If there are no admins or no users (e.g. fresh ephemeral container on Render)
                if not CustomUser.objects.filter(user_type='admin').exists():
                    logger.info("SMART FYP UTC: Fresh database detected. Auto-seeding initial demo data...")
                    from django.core.management import call_command
                    call_command('seed_admin_data')
                    logger.info("SMART FYP UTC: Auto-seeding completed.")
        except Exception as e:
            # Avoid crashing if database is not reachable yet
            logger.warning(f"SMART FYP UTC: Auto-seeding check skipped: {str(e)}")
