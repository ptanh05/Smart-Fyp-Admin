"""
Idempotent shared schema enhancements across Admin and Client backends.

Both backends share one Neon PostgreSQL database while keeping independent
migration histories. Uses SeparateDatabaseAndState with IF NOT EXISTS guards.
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def _sqlite_columns(cursor, table_name):
    cursor.execute(f"PRAGMA table_info({table_name});")
    return {row[1] for row in cursor.fetchall()}


def apply_schema_changes(apps, schema_editor):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        if connection.vendor == "postgresql":
            cursor.execute("""
                ALTER TABLE app_academicbatch
                ADD COLUMN IF NOT EXISTS supplementary_open boolean DEFAULT false NOT NULL;

                ALTER TABLE app_thesisdeferralrequest
                ADD COLUMN IF NOT EXISTS supervisor_feedback text DEFAULT '' NOT NULL;

                ALTER TABLE app_thesisdeferralrequest
                ADD COLUMN IF NOT EXISTS supervisor_reviewed_at timestamp with time zone NULL;

                ALTER TABLE app_thesisdeferralrequest
                ADD COLUMN IF NOT EXISTS created_by_admin boolean DEFAULT false NOT NULL;

                CREATE TABLE IF NOT EXISTS app_batchmilestone (
                    id bigserial PRIMARY KEY,
                    batch_id bigint NOT NULL REFERENCES app_academicbatch(id) ON DELETE CASCADE,
                    name varchar(255) NOT NULL,
                    stage_number smallint NOT NULL DEFAULT 1,
                    start_date timestamp with time zone NULL,
                    end_date timestamp with time zone NULL,
                    description text NOT NULL DEFAULT '',
                    order_index integer NOT NULL DEFAULT 1,
                    is_active boolean NOT NULL DEFAULT true,
                    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_batchmilestone_batch_order
                    ON app_batchmilestone (batch_id, order_index);

                CREATE TABLE IF NOT EXISTS app_defenseminutessignature (
                    id bigserial PRIMARY KEY,
                    council_id bigint NOT NULL REFERENCES app_defensecouncil(id) ON DELETE CASCADE,
                    project_id bigint NOT NULL REFERENCES app_graduationproject(id) ON DELETE CASCADE,
                    member_id bigint NOT NULL REFERENCES app_councilmember(id) ON DELETE CASCADE,
                    signed_by_id bigint NULL REFERENCES app_customuser(id) ON DELETE SET NULL,
                    note varchar(255) NOT NULL DEFAULT '',
                    signed_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT app_defenseminutessignature_project_member_uniq UNIQUE (project_id, member_id)
                );
                CREATE INDEX IF NOT EXISTS idx_defminsig_council_project
                    ON app_defenseminutessignature (council_id, project_id);

                CREATE TABLE IF NOT EXISTS app_securitypolicy (
                    id bigserial PRIMARY KEY,
                    policy_key varchar(64) NOT NULL UNIQUE,
                    label varchar(255) NOT NULL,
                    policy_value varchar(255) NOT NULL,
                    description text NOT NULL DEFAULT '',
                    updated_by_id bigint NULL REFERENCES app_customuser(id) ON DELETE SET NULL,
                    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS app_usersessionlog (
                    id bigserial PRIMARY KEY,
                    user_id bigint NOT NULL REFERENCES app_customuser(id) ON DELETE CASCADE,
                    token_jti varchar(128) NOT NULL,
                    portal varchar(32) NOT NULL DEFAULT 'portal',
                    ip_address inet NULL,
                    user_agent varchar(500) NOT NULL DEFAULT '',
                    is_active boolean NOT NULL DEFAULT true,
                    revoked_at timestamp with time zone NULL,
                    revoked_by_id bigint NULL REFERENCES app_customuser(id) ON DELETE SET NULL,
                    revoke_reason varchar(255) NOT NULL DEFAULT '',
                    last_seen_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_usersessionlog_jti ON app_usersessionlog (token_jti);
                CREATE INDEX IF NOT EXISTS idx_usersessionlog_active ON app_usersessionlog (is_active);
                CREATE INDEX IF NOT EXISTS idx_usersessionlog_created ON app_usersessionlog (created_at);
            """)
        else:
            batch_cols = _sqlite_columns(cursor, "app_academicbatch")
            if "supplementary_open" not in batch_cols:
                cursor.execute(
                    "ALTER TABLE app_academicbatch ADD COLUMN supplementary_open bool NOT NULL DEFAULT 0;"
                )

            def_cols = _sqlite_columns(cursor, "app_thesisdeferralrequest")
            if "supervisor_feedback" not in def_cols:
                cursor.execute(
                    "ALTER TABLE app_thesisdeferralrequest ADD COLUMN supervisor_feedback text NOT NULL DEFAULT '';"
                )
            if "supervisor_reviewed_at" not in def_cols:
                cursor.execute(
                    "ALTER TABLE app_thesisdeferralrequest ADD COLUMN supervisor_reviewed_at datetime NULL;"
                )
            if "created_by_admin" not in def_cols:
                cursor.execute(
                    "ALTER TABLE app_thesisdeferralrequest ADD COLUMN created_by_admin bool NOT NULL DEFAULT 0;"
                )

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS app_batchmilestone (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    batch_id integer NOT NULL REFERENCES app_academicbatch(id) ON DELETE CASCADE,
                    name varchar(255) NOT NULL,
                    stage_number integer NOT NULL DEFAULT 1,
                    start_date datetime NULL,
                    end_date datetime NULL,
                    description text NOT NULL DEFAULT '',
                    order_index integer NOT NULL DEFAULT 1,
                    is_active bool NOT NULL DEFAULT 1,
                    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_batchmilestone_batch_order ON app_batchmilestone (batch_id, order_index);"
            )

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS app_defenseminutessignature (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    council_id integer NOT NULL REFERENCES app_defensecouncil(id) ON DELETE CASCADE,
                    project_id integer NOT NULL REFERENCES app_graduationproject(id) ON DELETE CASCADE,
                    member_id integer NOT NULL REFERENCES app_councilmember(id) ON DELETE CASCADE,
                    signed_by_id integer NULL REFERENCES app_customuser(id) ON DELETE SET NULL,
                    note varchar(255) NOT NULL DEFAULT '',
                    signed_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (project_id, member_id)
                );
            """)
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_defminsig_council_project ON app_defenseminutessignature (council_id, project_id);"
            )

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS app_securitypolicy (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    policy_key varchar(64) NOT NULL UNIQUE,
                    label varchar(255) NOT NULL,
                    policy_value varchar(255) NOT NULL,
                    description text NOT NULL DEFAULT '',
                    updated_by_id integer NULL REFERENCES app_customuser(id) ON DELETE SET NULL,
                    updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS app_usersessionlog (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    user_id integer NOT NULL REFERENCES app_customuser(id) ON DELETE CASCADE,
                    token_jti varchar(128) NOT NULL,
                    portal varchar(32) NOT NULL DEFAULT 'portal',
                    ip_address char(39) NULL,
                    user_agent varchar(500) NOT NULL DEFAULT '',
                    is_active bool NOT NULL DEFAULT 1,
                    revoked_at datetime NULL,
                    revoked_by_id integer NULL REFERENCES app_customuser(id) ON DELETE SET NULL,
                    revoke_reason varchar(255) NOT NULL DEFAULT '',
                    last_seen_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_usersessionlog_jti ON app_usersessionlog (token_jti);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_usersessionlog_active ON app_usersessionlog (is_active);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_usersessionlog_created ON app_usersessionlog (created_at);")


def noop_reverse(apps, schema_editor):
    pass


STATE_OPERATIONS = [
    migrations.AddField(
        model_name="academicbatch",
        name="supplementary_open",
        field=models.BooleanField(default=False),
    ),
    migrations.AddField(
        model_name="thesisdeferralrequest",
        name="supervisor_feedback",
        field=models.TextField(blank=True, default=""),
    ),
    migrations.AddField(
        model_name="thesisdeferralrequest",
        name="supervisor_reviewed_at",
        field=models.DateTimeField(blank=True, null=True),
    ),
    migrations.AddField(
        model_name="thesisdeferralrequest",
        name="created_by_admin",
        field=models.BooleanField(default=False),
    ),
    migrations.CreateModel(
        name="BatchMilestone",
        fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("name", models.CharField(max_length=255)),
            ("stage_number", models.PositiveSmallIntegerField(default=1)),
            ("start_date", models.DateTimeField(blank=True, null=True)),
            ("end_date", models.DateTimeField(blank=True, null=True)),
            ("description", models.TextField(blank=True, default="")),
            ("order_index", models.PositiveIntegerField(default=1)),
            ("is_active", models.BooleanField(default=True)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            (
                "batch",
                models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="milestones",
                    to="app.academicbatch",
                ),
            ),
        ],
        options={
            "verbose_name": "Mốc thời gian đợt đồ án",
            "verbose_name_plural": "Danh sách Mốc thời gian đợt đồ án",
            "db_table": "app_batchmilestone",
            "ordering": ["order_index", "start_date", "id"],
        },
    ),
    migrations.CreateModel(
        name="DefenseMinutesSignature",
        fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("note", models.CharField(blank=True, default="", max_length=255)),
            ("signed_at", models.DateTimeField(auto_now_add=True)),
            (
                "council",
                models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="minutes_signatures",
                    to="app.defensecouncil",
                ),
            ),
            (
                "member",
                models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="minutes_signatures",
                    to="app.councilmember",
                ),
            ),
            (
                "project",
                models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="minutes_signatures",
                    to="app.graduationproject",
                ),
            ),
            (
                "signed_by",
                models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="defense_minutes_signatures",
                    to=settings.AUTH_USER_MODEL,
                ),
            ),
        ],
        options={
            "verbose_name": "Chữ ký biên bản bảo vệ",
            "verbose_name_plural": "Danh sách Chữ ký biên bản bảo vệ",
            "db_table": "app_defenseminutessignature",
            "ordering": ["signed_at", "id"],
            "unique_together": {("project", "member")},
        },
    ),
    migrations.CreateModel(
        name="SecurityPolicy",
        fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("policy_key", models.CharField(max_length=64, unique=True)),
            ("label", models.CharField(max_length=255)),
            ("policy_value", models.CharField(max_length=255)),
            ("description", models.TextField(blank=True, default="")),
            ("updated_at", models.DateTimeField(auto_now=True)),
            (
                "updated_by",
                models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="updated_security_policies",
                    to=settings.AUTH_USER_MODEL,
                ),
            ),
        ],
        options={
            "verbose_name": "Chính sách bảo mật",
            "verbose_name_plural": "Danh sách Chính sách bảo mật",
            "db_table": "app_securitypolicy",
            "ordering": ["policy_key"],
        },
    ),
    migrations.CreateModel(
        name="UserSessionLog",
        fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("token_jti", models.CharField(db_index=True, max_length=128)),
            ("portal", models.CharField(default="portal", max_length=32)),
            ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
            ("user_agent", models.CharField(blank=True, default="", max_length=500)),
            ("is_active", models.BooleanField(db_index=True, default=True)),
            ("revoked_at", models.DateTimeField(blank=True, null=True)),
            ("revoke_reason", models.CharField(blank=True, default="", max_length=255)),
            ("last_seen_at", models.DateTimeField(auto_now=True)),
            ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            (
                "revoked_by",
                models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="revoked_session_logs",
                    to=settings.AUTH_USER_MODEL,
                ),
            ),
            (
                "user",
                models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="session_logs",
                    to=settings.AUTH_USER_MODEL,
                ),
            ),
        ],
        options={
            "verbose_name": "Phiên đăng nhập",
            "verbose_name_plural": "Danh sách Phiên đăng nhập",
            "db_table": "app_usersessionlog",
            "ordering": ["-created_at", "-id"],
        },
    ),
]


class Migration(migrations.Migration):

    dependencies = [
        ("app", "0007_notification_action_url"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=STATE_OPERATIONS,
            database_operations=[
                migrations.RunPython(apply_schema_changes, noop_reverse),
            ],
        ),
    ]
