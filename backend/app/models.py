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
        return f"AuditLog #{self.pk} - {self.action_type}"


class AcademicBatch(models.Model):
    batch_code = models.CharField(max_length=50, unique=True)
    batch_name = models.CharField(max_length=255)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_academicbatch"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.batch_name} ({self.batch_code})"


class CourseClass(models.Model):
    PROGRAM_CHOICES = (
        ("VIET_ANH", "Công nghệ thông tin Việt - Anh"),
        ("DAI_TRA", "Công nghệ thông tin Đại trà"),
        ("KHMT", "Khoa học máy tính"),
        ("KHOA_CU", "Sinh viên Khóa cũ"),
    )
    batch = models.ForeignKey(AcademicBatch, on_delete=models.CASCADE, related_name="course_classes")
    class_code = models.CharField(max_length=50)
    class_name = models.CharField(max_length=255)
    program_type = models.CharField(max_length=50, choices=PROGRAM_CHOICES, default="DAI_TRA")
    class_group = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        db_table = "app_courseclass"
        ordering = ["class_code"]

    def __str__(self):
        return f"{self.class_name} - {self.class_code}"


class ProjectCategories(models.Model):
    category_name = models.CharField(max_length=100)

    class Meta:
        db_table = "app_projectcategories"

    def __str__(self):
        return self.category_name


class Student(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="admin_student_profile")
    registration_no = models.CharField(max_length=20, unique=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    semester = models.CharField(max_length=100, blank=True, null=True)
    batch_no = models.CharField(max_length=100, blank=True, null=True)
    phone_number = models.CharField(max_length=30, blank=True, null=True)
    course_class = models.ForeignKey(CourseClass, on_delete=models.SET_NULL, null=True, blank=True, related_name="students")
    academic_batch = models.ForeignKey(AcademicBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name="students")

    class Meta:
        db_table = "app_student"

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.registration_no})"


class Supervisor(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="admin_supervisor_profile")
    supervisor_id = models.CharField(max_length=100, unique=True)
    research_interest = models.CharField(max_length=255, blank=True, null=True)
    academic_background = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=30, blank=True, null=True)
    academic_title = models.CharField(max_length=50, blank=True, null=True)
    department_name = models.CharField(max_length=100, blank=True, null=True)
    is_external = models.BooleanField(default=False)
    category = models.ManyToManyField(ProjectCategories, related_name="supervisors", blank=True)

    class Meta:
        db_table = "app_supervisor"

    def __str__(self):
        prefix = f"{self.academic_title} " if self.academic_title else ""
        return f"{prefix}{self.user.get_full_name() or self.user.username}"


class SupervisorQuota(models.Model):
    supervisor = models.ForeignKey(Supervisor, on_delete=models.CASCADE, related_name="quotas")
    batch = models.ForeignKey(AcademicBatch, on_delete=models.CASCADE, related_name="supervisor_quotas")
    department = models.CharField(max_length=100, blank=True, null=True)
    viet_anh_quota = models.IntegerField(default=0)
    general_cntt_quota = models.IntegerField(default=0)
    max_total_quota = models.IntegerField(default=0)
    current_assigned = models.IntegerField(default=0)

    class Meta:
        db_table = "app_supervisorquota"
        unique_together = ("supervisor", "batch")

    def __str__(self):
        return f"{self.supervisor} Quota: {self.max_total_quota}"


class ProjectTopicArea(models.Model):
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "app_projecttopicarea"

    def __str__(self):
        return self.name


class InternshipInfo(models.Model):
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name="internship_info")
    batch = models.ForeignKey(AcademicBatch, on_delete=models.CASCADE, related_name="internship_submissions")
    is_interning = models.BooleanField(default=False)
    company_name = models.CharField(max_length=255, blank=True, null=True)
    topic_direction = models.ForeignKey(ProjectTopicArea, on_delete=models.SET_NULL, null=True, blank=True, related_name="internships")
    preferred_supervisor = models.ForeignKey(Supervisor, on_delete=models.SET_NULL, null=True, blank=True, related_name="preferred_by_students")
    tentative_title = models.CharField(max_length=500, blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "app_internshipinfo"


class DefenseCouncil(models.Model):
    SESSION_CHOICES = (
        ("MORNING", "Ca sáng"),
        ("AFTERNOON", "Ca chiều"),
    )
    batch = models.ForeignKey(AcademicBatch, on_delete=models.CASCADE, related_name="defense_councils")
    council_number = models.IntegerField(default=1)
    council_name = models.CharField(max_length=255)
    session_date = models.DateField(null=True, blank=True)
    session_time = models.CharField(max_length=50, choices=SESSION_CHOICES, default="MORNING")
    defense_room = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_defensecouncil"
        ordering = ["batch", "council_number"]

    def __str__(self):
        return f"{self.council_name} (HĐ {self.council_number})"


class CouncilMember(models.Model):
    ROLE_CHOICES = (
        ("CHAIR", "Chủ tịch hội đồng"),
        ("SECRETARY", "Ủy viên, Thư ký"),
        ("MEMBER", "Ủy viên"),
        ("EXTERNAL_MEMBER", "Ủy viên ngoài trường"),
    )
    council = models.ForeignKey(DefenseCouncil, on_delete=models.CASCADE, related_name="members")
    supervisor = models.ForeignKey(Supervisor, on_delete=models.SET_NULL, null=True, blank=True, related_name="council_memberships")
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="council_roles")
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default="MEMBER")
    external_institution = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = "app_councilmember"
        unique_together = ("council", "user")


class GraduationProject(models.Model):
    STATUS_CHOICES = (
        ("ALLOCATED", "Đã phân GVHD"),
        ("OUTLINE_PENDING", "Chờ duyệt đề cương"),
        ("OUTLINE_REVISION", "Yêu cầu sửa đề cương"),
        ("OUTLINE_APPROVED", "Đề cương đã duyệt"),
        ("IN_PROGRESS", "Đang thực hiện đồ án"),
        ("DEFENSE_READY", "Đủ điều kiện bảo vệ"),
        ("PASSED", "Bảo vệ thành công - Đạt"),
        ("FAILED", "Không đạt"),
        ("DEFERRED", "Bảo lưu đồ án"),
    )
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name="graduation_project")
    supervisor = models.ForeignKey(Supervisor, on_delete=models.CASCADE, related_name="supervised_graduation_projects")
    batch = models.ForeignKey(AcademicBatch, on_delete=models.CASCADE, related_name="graduation_projects")
    topic_category = models.ForeignKey(ProjectTopicArea, on_delete=models.SET_NULL, null=True, blank=True, related_name="projects")
    topic_title_vi = models.CharField(max_length=500)
    topic_title_en = models.CharField(max_length=500, blank=True, null=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="ALLOCATED")
    reviewer = models.ForeignKey(Supervisor, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_graduation_projects")
    council = models.ForeignKey(DefenseCouncil, on_delete=models.SET_NULL, null=True, blank=True, related_name="projects")
    supervisor_score = models.FloatField(null=True, blank=True)
    supervisor_feedback = models.TextField(blank=True, null=True)
    is_eligible_for_defense = models.BooleanField(default=False)
    reviewer_score = models.FloatField(null=True, blank=True)
    reviewer_feedback = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "app_graduationproject"


class OutlineReviewGroup(models.Model):
    batch = models.ForeignKey(AcademicBatch, on_delete=models.CASCADE, related_name="outline_review_groups")
    name = models.CharField(max_length=255)
    department = models.CharField(max_length=100)
    members = models.ManyToManyField(Supervisor, related_name="outline_groups", blank=True)

    class Meta:
        db_table = "app_outlinereviewgroup"


class OutlineReview(models.Model):
    VERDICT_CHOICES = (
        ("PENDING", "Chờ xét duyệt"),
        ("APPROVED", "Đạt yêu cầu"),
        ("REVISION_REQUIRED", "Yêu cầu chỉnh sửa"),
        ("REJECTED", "Không đạt / Hủy đề tài"),
    )
    project = models.OneToOneField(GraduationProject, on_delete=models.CASCADE, related_name="outline_review")
    review_group = models.ForeignKey(OutlineReviewGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_outlines")
    reviewer = models.ForeignKey(Supervisor, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_outline_reviews")
    outline_file = models.FileField(upload_to="outlines/", null=True, blank=True)
    verdict = models.CharField(max_length=50, choices=VERDICT_CHOICES, default="PENDING")
    comments = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "app_outlinereview"


class WeeklyProgressReport(models.Model):
    RATING_CHOICES = (
        ("PENDING", "Chưa đánh giá"),
        ("GOOD", "Tốt / Đạt tiến độ"),
        ("ACCEPTABLE", "Chấp nhận được"),
        ("LATE", "Chậm tiến độ"),
        ("UNSATISFACTORY", "Không đạt yêu cầu"),
    )
    project = models.ForeignKey(GraduationProject, on_delete=models.CASCADE, related_name="weekly_reports")
    week_number = models.IntegerField()
    summary_content = models.TextField()
    planned_tasks = models.TextField(blank=True, null=True)
    git_commit_link = models.URLField(max_length=500, blank=True, null=True)
    attached_file = models.FileField(upload_to="weekly_reports/", null=True, blank=True)
    supervisor_feedback = models.TextField(blank=True, null=True)
    supervisor_rating = models.CharField(max_length=50, choices=RATING_CHOICES, default="PENDING")
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "app_weeklyprogressreport"
        unique_together = ("project", "week_number")


class CouncilLiveScore(models.Model):
    council = models.ForeignKey(DefenseCouncil, on_delete=models.CASCADE, related_name="live_scores")
    project = models.ForeignKey(GraduationProject, on_delete=models.CASCADE, related_name="council_scores")
    member = models.ForeignKey(CouncilMember, on_delete=models.CASCADE, related_name="given_scores")
    score_presentation = models.FloatField(default=0.0)
    score_content = models.FloatField(default=0.0)
    score_qa = models.FloatField(default=0.0)
    score_demo = models.FloatField(default=0.0)
    total_score = models.FloatField(default=0.0)
    comments = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_councillivescore"
        unique_together = ("project", "member")

    def save(self, *args, **kwargs):
        self.total_score = round(
            float(self.score_presentation) + float(self.score_content) + float(self.score_qa) + float(self.score_demo), 2
        )
        super().save(*args, **kwargs)


class EvaluationPolicy(models.Model):
    batch = models.OneToOneField(AcademicBatch, on_delete=models.CASCADE, related_name="evaluation_policy")
    weight_supervisor = models.FloatField(default=0.4)
    weight_reviewer = models.FloatField(default=0.2)
    weight_council = models.FloatField(default=0.4)

    class Meta:
        db_table = "app_evaluationpolicy"

    def clean(self):
        total = round(self.weight_supervisor + self.weight_reviewer + self.weight_council, 2)
        if total != 1.0:
            from django.core.exceptions import ValidationError
            raise ValidationError("Tổng các trọng số phải bằng 1.0 (100%)")


class FinalGradeSummary(models.Model):
    project = models.OneToOneField(GraduationProject, on_delete=models.CASCADE, related_name="final_grade_summary")
    supervisor_score = models.FloatField(null=True, blank=True)
    reviewer_score = models.FloatField(null=True, blank=True)
    council_avg_score = models.FloatField(null=True, blank=True)
    final_score_10 = models.FloatField(null=True, blank=True)
    final_score_4 = models.FloatField(null=True, blank=True)
    final_letter_grade = models.CharField(max_length=10, blank=True, null=True)
    classification = models.CharField(max_length=50, blank=True, null=True)
    is_passed = models.BooleanField(default=False)
    is_finalized = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "app_finalgradesummary"

    def calculate_and_save(self, policy=None):
        w_sup = policy.weight_supervisor if policy else 0.4
        w_rev = policy.weight_reviewer if policy else 0.2
        w_cou = policy.weight_council if policy else 0.4

        s_sup = self.supervisor_score or 0.0
        s_rev = self.reviewer_score or 0.0
        s_cou = self.council_avg_score or 0.0

        score10 = round((s_sup * w_sup) + (s_rev * w_rev) + (s_cou * w_cou), 2)
        self.final_score_10 = score10

        if score10 >= 9.0:
            self.final_score_4 = 4.0
            self.final_letter_grade = "A+"
            self.classification = "Xuất sắc"
            self.is_passed = True
        elif score10 >= 8.5:
            self.final_score_4 = 4.0
            self.final_letter_grade = "A"
            self.classification = "Giỏi"
            self.is_passed = True
        elif score10 >= 8.0:
            self.final_score_4 = 3.5
            self.final_letter_grade = "B+"
            self.classification = "Khá giỏi"
            self.is_passed = True
        elif score10 >= 7.0:
            self.final_score_4 = 3.0
            self.final_letter_grade = "B"
            self.classification = "Khá"
            self.is_passed = True
        elif score10 >= 6.5:
            self.final_score_4 = 2.5
            self.final_letter_grade = "C+"
            self.classification = "Trung bình khá"
            self.is_passed = True
        elif score10 >= 5.5:
            self.final_score_4 = 2.0
            self.final_letter_grade = "C"
            self.classification = "Trung bình"
            self.is_passed = True
        elif score10 >= 5.0:
            self.final_score_4 = 1.5
            self.final_letter_grade = "D+"
            self.classification = "Trung bình yếu"
            self.is_passed = True
        elif score10 >= 4.0:
            self.final_score_4 = 1.0
            self.final_letter_grade = "D"
            self.classification = "Yếu"
            self.is_passed = True
        else:
            self.final_score_4 = 0.0
            self.final_letter_grade = "F"
            self.classification = "Kém (Không đạt)"
            self.is_passed = False

        self.save()

