"""
Mirrored (unmanaged) models cho các bảng mở rộng được tạo bởi smart-fyp-management backend.

Quy tắc: managed = False — admin backend KHÔNG tạo / sửa / xóa bảng này qua migrate.
Schema phải khớp db_table và cột với feature_models.py trong main repo.
Test runner (LegacyTableTestRunner) sẽ tạo các bảng này trong SQLite test DB tự động.
"""
from django.db import models


class SubmissionVersion(models.Model):
    KIND_CHOICES = (
        ("OUTLINE", "Đề cương"),
        ("REPORT", "Báo cáo / Quyển đồ án"),
        ("SLIDES", "Slide bảo vệ"),
        ("SOURCE", "Mã nguồn"),
        ("OTHER", "Khác"),
    )
    SIMILARITY_STATUS_CHOICES = (
        ("NOT_CHECKED", "Chưa kiểm tra"),
        ("CHECKED", "Đã kiểm tra"),
        ("UNSUPPORTED", "Không trích xuất được nội dung"),
    )
    REVIEW_STATUS_CHOICES = (
        ("PENDING", "Chờ GVHD duyệt"),
        ("APPROVED", "GVHD đã duyệt"),
        ("REVISION_REQUIRED", "GVHD yêu cầu sửa"),
    )

    project = models.ForeignKey(
        "GraduationProject",
        on_delete=models.CASCADE,
        related_name="submission_versions",
        db_constraint=False,
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="REPORT")
    version_no = models.PositiveIntegerField()
    file = models.CharField(max_length=500, blank=True, default="")  # FileField stored as path
    original_name = models.CharField(max_length=255, blank=True, default="")
    file_size = models.PositiveIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True, default="")
    note = models.TextField(blank=True, default="")
    uploaded_by = models.ForeignKey(
        "CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_submission_versions",
        db_constraint=False,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    extracted_text = models.TextField(blank=True, default="")
    similarity_status = models.CharField(max_length=20, choices=SIMILARITY_STATUS_CHOICES, default="NOT_CHECKED")
    similarity_score = models.FloatField(null=True, blank=True)
    similarity_matches = models.JSONField(default=list, blank=True)
    similarity_checked_at = models.DateTimeField(null=True, blank=True)
    supervisor_review_status = models.CharField(
        max_length=20, choices=REVIEW_STATUS_CHOICES, default="PENDING"
    )
    supervisor_feedback = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        "CustomUser", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="admin_reviewed_submission_versions", db_constraint=False
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "app_submissionversion"
        managed = False
        ordering = ["project_id", "kind", "-version_no"]
        unique_together = ("project", "kind", "version_no")
        verbose_name = "Phiên bản bài nộp"
        verbose_name_plural = "Phiên bản bài nộp"

    def __str__(self):
        return f"{self.project_id} {self.kind} v{self.version_no}"


class Rubric(models.Model):
    ROLE_CHOICES = (
        ("SUPERVISOR", "GV hướng dẫn"),
        ("REVIEWER", "GV phản biện"),
        ("COUNCIL", "Thành viên hội đồng"),
    )
    name = models.CharField(max_length=255)
    evaluator_role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    batch = models.ForeignKey(
        "AcademicBatch",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rubrics",
        db_constraint=False,
        help_text="Để trống = dùng chung cho mọi đợt",
    )
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_rubric"
        managed = False
        ordering = ["evaluator_role", "-created_at"]
        verbose_name = "Rubric chấm điểm"
        verbose_name_plural = "Danh sách Rubric"

    def __str__(self):
        return f"{self.name} ({self.evaluator_role})"


class RubricCriterion(models.Model):
    rubric = models.ForeignKey(
        Rubric,
        on_delete=models.CASCADE,
        related_name="criteria",
        db_constraint=False,
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    max_score = models.FloatField(default=10.0)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "app_rubriccriterion"
        managed = False
        ordering = ["rubric_id", "order", "id"]
        verbose_name = "Tiêu chí rubric"
        verbose_name_plural = "Tiêu chí rubric"

    def __str__(self):
        return f"{self.name} (max {self.max_score})"


class RubricScore(models.Model):
    project = models.ForeignKey(
        "GraduationProject",
        on_delete=models.CASCADE,
        related_name="rubric_scores",
        db_constraint=False,
    )
    rubric = models.ForeignKey(
        Rubric,
        on_delete=models.CASCADE,
        related_name="scores",
        db_constraint=False,
    )
    evaluator = models.ForeignKey(
        "CustomUser",
        on_delete=models.CASCADE,
        related_name="admin_rubric_scores",
        db_constraint=False,
    )
    criterion_scores = models.JSONField(default=dict)
    # Mirrors main-repo migration 0011_feature_rubric_draft (NOT NULL columns).
    criterion_comments = models.JSONField(default=dict, blank=True)
    total_10 = models.FloatField(default=0.0)
    comment = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, default="DRAFT",
                              choices=(("DRAFT", "Bản nháp"), ("SUBMITTED", "Đã nộp")))
    locked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "app_rubricscore"
        managed = False
        unique_together = ("project", "rubric", "evaluator")
        verbose_name = "Điểm rubric"
        verbose_name_plural = "Danh sách điểm rubric"


class CalendarFeedToken(models.Model):
    user = models.OneToOneField(
        "CustomUser",
        on_delete=models.CASCADE,
        related_name="admin_calendar_feed_token",
        db_constraint=False,
    )
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_calendarfeedtoken"
        managed = False


class DeadlineReminderLog(models.Model):
    task = models.ForeignKey(
        "SupervisionTask",
        on_delete=models.CASCADE,
        related_name="admin_reminder_logs",
        db_constraint=False,
    )
    user = models.ForeignKey(
        "CustomUser",
        on_delete=models.CASCADE,
        related_name="admin_deadline_reminders",
        db_constraint=False,
    )
    milestone = models.CharField(max_length=20)
    sent_at = models.DateTimeField()

    class Meta:
        db_table = "app_deadlinereminderlog"
        managed = False
        unique_together = ("task", "user", "milestone")


class ThesisArchiveRecord(models.Model):
    VISIBILITY_CHOICES = (
        ("PUBLIC", "Công khai"),
        ("INTERNAL", "Nội bộ Khoa"),
        ("EMBARGOED", "Hạn chế công bố (embargo)"),
    )
    project = models.OneToOneField(
        "GraduationProject",
        on_delete=models.CASCADE,
        related_name="archive_record",
        db_constraint=False,
    )
    title = models.CharField(max_length=500)
    abstract = models.TextField(blank=True, default="")
    keywords = models.CharField(max_length=500, blank=True, default="")
    final_version = models.ForeignKey(
        SubmissionVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="archive_records",
        db_constraint=False,
    )
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default="PUBLIC")
    embargo_until = models.DateField(null=True, blank=True)
    embargo_reason = models.TextField(blank=True, default="")
    license = models.CharField(max_length=100, blank=True, default="All rights reserved")
    final_score = models.FloatField(null=True, blank=True)
    archived_by = models.ForeignKey(
        "CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_archived_theses",
        db_constraint=False,
    )
    archived_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_thesisarchiverecord"
        managed = False
        ordering = ["-archived_at"]
        verbose_name = "Bản lưu trữ đồ án"
        verbose_name_plural = "Kho lưu trữ đồ án"

    def __str__(self):
        return f"Archive: {self.project_id} — {self.title[:60]}"

    @property
    def is_embargoed(self):
        from django.utils import timezone
        if self.visibility != "EMBARGOED":
            return False
        return self.embargo_until is None or self.embargo_until > timezone.localdate()
