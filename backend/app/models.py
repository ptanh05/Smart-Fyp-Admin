from django.db import models
from django.contrib.auth.models import AbstractUser

class CustomUser(AbstractUser):
    USER_TYPE_CHOICES = (
        ("student", "Student"),
        ("supervisor", "Supervisor"),
        ("committee_member", "Committee Member"),
        ("external_examiner", "External Examiner"),
        ("admin", "Admin"),
    )
    user_type = models.CharField(max_length=50, choices=USER_TYPE_CHOICES)

    class Meta:
        db_table = "app_customuser"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.username


class AuditLog(models.Model):
    ACTION_TYPE_CHOICES = (
        ("evaluation_update", "Evaluation Update"),
        ("document_status_change", "Document Status Change"),
        ("group_status_change", "Group Status Change"),
        ("supervisor_request_update", "Supervisor Request Update"),
        ("admin_user_update", "Admin User Update"),
    )
    
    EVALUATION_TYPE_CHOICES = (
        ("scope_document", "Scope Document"),
        ("srs_supervisor", "SRS Supervisor"),
        ("srs_committee", "SRS Committee Member"),
        ("sdd_supervisor", "SDD Supervisor"),
        ("sdd_committee", "SDD Committee Member"),
        ("evaluation3_supervisor", "Evaluation 3 Supervisor"),
        ("evaluation3_committee", "Evaluation 3 Committee Member"),
        ("evaluation4_supervisor", "Evaluation 4 Supervisor"),
        ("evaluation4_committee", "Evaluation 4 Committee Member"),
    )
    
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name="admin_audit_logs"
    )
    action_type = models.CharField(max_length=50, choices=ACTION_TYPE_CHOICES, default="evaluation_update")
    evaluation_type = models.CharField(max_length=50, choices=EVALUATION_TYPE_CHOICES, blank=True, null=True)
    description = models.TextField()
    field_name = models.CharField(max_length=100, blank=True, null=True)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_auditlog"
        ordering = ["-created_at"]

    def __str__(self):
        return f"AuditLog #{self.id} - {self.action_type}"
