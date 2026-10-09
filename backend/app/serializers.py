from rest_framework import serializers
from .models import (
    CustomUser,
    AuditLog,
    AcademicBatch,
    CourseClass,
    Department,
    Student,
    Supervisor,
    SupervisorQuota,
    ProjectTopicArea,
    StudentPreference,
    GraduationProject,
    DefenseCouncil,
    CouncilMember,
    DefenseScheduleSlot,
    FinalGradeSummary,
    EvaluationPolicy,
    OutlineReviewGroup,
    OutlineReview
)

class DepartmentSerializer(serializers.ModelSerializer):
    supervisor_count = serializers.IntegerField(source="supervisors.count", read_only=True)

    class Meta:
        model = Department
        fields = ["id", "code", "name", "description", "supervisor_count"]


class StudentDetailSerializer(serializers.ModelSerializer):
    batch_name = serializers.CharField(source="academic_batch.batch_name", read_only=True, default="")
    class_code = serializers.CharField(source="course_class.class_code", read_only=True, default="")
    class_name = serializers.CharField(source="course_class.class_name", read_only=True, default="")
    program_type = serializers.CharField(source="course_class.program_type", read_only=True, default="")
    supervisor_name = serializers.SerializerMethodField()
    supervisor_id = serializers.SerializerMethodField()
    topic_title = serializers.SerializerMethodField()
    major = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id",
            "registration_no",
            "department",
            "semester",
            "batch_no",
            "phone_number",
            "education_program",
            "course_class",
            "class_code",
            "class_name",
            "program_type",
            "academic_batch",
            "batch_name",
            "supervisor_id",
            "supervisor_name",
            "topic_title",
            "major",
        ]

    def get_supervisor_name(self, obj):
        proj = getattr(obj, "graduation_project", None)
        if proj and proj.supervisor:
            prefix = f"{proj.supervisor.academic_title} " if proj.supervisor.academic_title else ""
            return f"{prefix}{proj.supervisor.user.get_full_name() or proj.supervisor.user.username}".strip()
        return ""

    def get_supervisor_id(self, obj):
        proj = getattr(obj, "graduation_project", None)
        return proj.supervisor.id if proj and proj.supervisor else None

    def get_topic_title(self, obj):
        proj = getattr(obj, "graduation_project", None)
        return proj.topic_title_vi if proj else ""

    def get_major(self, obj):
        if obj.course_class and obj.course_class.program_type == "KHMT":
            return "KHMT"
        dept = (obj.department or "").lower()
        if "khoa học máy tính" in dept or "khmt" in dept:
            return "KHMT"
        return "CNTT"


class SupervisorDetailSerializer(serializers.ModelSerializer):
    quota_info = serializers.SerializerMethodField()
    department_code = serializers.CharField(source="department_obj.code", read_only=True, default="")

    class Meta:
        model = Supervisor
        fields = [
            "id",
            "supervisor_id",
            "academic_title",
            "department_name",
            "department_obj",
            "department_code",
            "academic_rank_multiplier",
            "phone_number",
            "research_interest",
            "academic_background",
            "is_external",
            "quota_info"
        ]

    def get_quota_info(self, obj):
        quota = obj.quotas.first()
        if quota:
            return {
                "base_quota": quota.base_quota,
                "rank_multiplier": quota.rank_multiplier,
                "viet_anh_quota": quota.viet_anh_quota,
                "general_cntt_quota": quota.general_cntt_quota,
                "max_total_quota": quota.max_total_quota,
                "current_assigned": quota.current_assigned,
            }
        return {
            "base_quota": 5,
            "rank_multiplier": obj.academic_rank_multiplier or 1.0,
            "viet_anh_quota": 0,
            "general_cntt_quota": 0,
            "max_total_quota": 0,
            "current_assigned": obj.supervised_graduation_projects.count(),
        }


class CouncilRoleDetailSerializer(serializers.ModelSerializer):
    council_name = serializers.CharField(source="council.council_name", read_only=True)
    council_number = serializers.IntegerField(source="council.council_number", read_only=True)

    class Meta:
        model = CouncilMember
        fields = ["id", "council", "council_name", "council_number", "role", "external_institution"]


class AdminUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    student_profile = serializers.SerializerMethodField()
    supervisor_profile = serializers.SerializerMethodField()
    council_roles = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "user_type",
            "is_active",
            "is_staff",
            "last_login",
            "date_joined",
            "student_profile",
            "supervisor_profile",
            "council_roles",
        ]

    def get_full_name(self, obj):
        if obj.last_name and obj.first_name:
            return f"{obj.last_name} {obj.first_name}".strip()
        return obj.get_full_name() or obj.username

    def get_student_profile(self, obj):
        try:
            std = getattr(obj, "admin_student_profile", None)
            if std:
                return StudentDetailSerializer(std).data
        except Exception:
            return None
        return None

    def get_supervisor_profile(self, obj):
        try:
            spv = getattr(obj, "admin_supervisor_profile", None)
            if spv:
                return SupervisorDetailSerializer(spv).data
        except Exception:
            return None
        return None

    def get_council_roles(self, obj):
        try:
            roles = obj.council_roles.all()
            if roles.exists():
                return CouncilRoleDetailSerializer(roles, many=True).data
        except Exception:
            return []
        return []


class AdminRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    admin_secret = serializers.CharField(write_only=True)


class AdminCreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(min_length=4, required=False, allow_blank=True)
    user_type = serializers.ChoiceField(choices=CustomUser.USER_TYPE_CHOICES)
    is_active = serializers.BooleanField(default=True, required=False)

    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=30, required=False, allow_blank=True)

    registration_no = serializers.CharField(max_length=50, required=False, allow_blank=True)
    education_program = serializers.ChoiceField(choices=["BACHELOR", "ENGINEER"], default="BACHELOR", required=False)
    major = serializers.ChoiceField(choices=["CNTT", "KHMT"], default="CNTT", required=False)
    program_type = serializers.ChoiceField(
        choices=["VIET_ANH", "DAI_TRA", "KHMT", "KHOA_CU"],
        default="DAI_TRA",
        required=False
    )
    class_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    course_class_id = serializers.IntegerField(required=False, allow_null=True)
    academic_batch_id = serializers.IntegerField(required=False, allow_null=True)
    password_strategy = serializers.ChoiceField(
        choices=["MSSV", "FIXED", "RANDOM", "CUSTOM"],
        default="MSSV",
        required=False
    )
    custom_password = serializers.CharField(max_length=128, required=False, allow_blank=True)

    supervisor_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    academic_title = serializers.CharField(max_length=50, required=False, allow_blank=True)
    department_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    department_id = serializers.IntegerField(required=False, allow_null=True)
    academic_rank_multiplier = serializers.FloatField(default=1.0, required=False)
    is_external = serializers.BooleanField(default=False, required=False)
    max_total_quota = serializers.IntegerField(default=5, required=False)
    viet_anh_quota = serializers.IntegerField(default=2, required=False)
    general_cntt_quota = serializers.IntegerField(default=3, required=False)

    external_institution = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AdminResetPasswordSerializer(serializers.Serializer):
    password_strategy = serializers.ChoiceField(
        choices=["MSSV", "FIXED", "RANDOM", "CUSTOM"],
        default="MSSV"
    )
    custom_password = serializers.CharField(max_length=128, required=False, allow_blank=True)


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True, default="System")
    user_role = serializers.CharField(source="user.user_type", read_only=True, default="system")

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "user_name",
            "user_role",
            "action_type",
            "evaluation_type",
            "description",
            "field_name",
            "old_value",
            "new_value",
            "created_at",
        ]


class CourseClassSerializer(serializers.ModelSerializer):
    student_count = serializers.IntegerField(source="students.count", read_only=True)

    class Meta:
        model = CourseClass
        fields = ["id", "batch", "class_code", "class_name", "program_type", "education_program", "class_group", "student_count"]


class AcademicBatchSerializer(serializers.ModelSerializer):
    classes = CourseClassSerializer(source="course_classes", many=True, read_only=True)
    student_count = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()

    class Meta:
        model = AcademicBatch
        fields = [
            "id",
            "batch_code",
            "batch_name",
            "program_type",
            "current_stage",
            "start_date",
            "end_date",
            "is_active",
            "is_allocation_published",
            "allocation_published_at",
            "is_closed",
            "created_at",
            "classes",
            "student_count",
            "project_count"
        ]

    def get_student_count(self, obj):
        return Student.objects.filter(academic_batch=obj).count()

    def get_project_count(self, obj):
        return GraduationProject.objects.filter(batch=obj).count()


class SupervisorQuotaSerializer(serializers.ModelSerializer):
    supervisor_name = serializers.SerializerMethodField()
    supervisor_id_code = serializers.CharField(source="supervisor.supervisor_id", read_only=True)
    academic_title = serializers.CharField(source="supervisor.academic_title", read_only=True)
    phone_number = serializers.CharField(source="supervisor.phone_number", read_only=True)

    class Meta:
        model = SupervisorQuota
        fields = [
            "id",
            "supervisor",
            "supervisor_id_code",
            "supervisor_name",
            "academic_title",
            "phone_number",
            "batch",
            "department",
            "base_quota",
            "rank_multiplier",
            "viet_anh_quota",
            "general_cntt_quota",
            "max_total_quota",
            "current_assigned"
        ]

    def get_supervisor_name(self, obj):
        user = obj.supervisor.user
        prefix = f"{obj.supervisor.academic_title} " if obj.supervisor.academic_title else ""
        return f"{prefix}{user.get_full_name() or user.username}".strip()


class CouncilMemberSerializer(serializers.ModelSerializer):
    lecturer_name = serializers.SerializerMethodField()
    academic_title = serializers.SerializerMethodField()

    class Meta:
        model = CouncilMember
        fields = ["id", "council", "supervisor", "user", "role", "external_institution", "lecturer_name", "academic_title"]

    def get_lecturer_name(self, obj):
        prefix = ""
        if obj.supervisor and obj.supervisor.academic_title:
            prefix = f"{obj.supervisor.academic_title} "
        return f"{prefix}{obj.user.get_full_name() or obj.user.username}".strip()

    def get_academic_title(self, obj):
        return obj.supervisor.academic_title if obj.supervisor else ""


class DefenseCouncilSerializer(serializers.ModelSerializer):
    members = CouncilMemberSerializer(many=True, read_only=True)
    project_count = serializers.SerializerMethodField()
    validity_info = serializers.SerializerMethodField()

    class Meta:
        model = DefenseCouncil
        fields = [
            "id",
            "batch",
            "council_number",
            "council_name",
            "session_date",
            "session_time",
            "defense_room",
            "is_finalized",
            "created_at",
            "members",
            "project_count",
            "validity_info"
        ]

    def get_project_count(self, obj):
        return obj.projects.count()

    def get_validity_info(self, obj):
        return obj.check_utc_model_validity()


class DefenseScheduleSlotSerializer(serializers.ModelSerializer):
    council_name = serializers.CharField(source="council.council_name", read_only=True)
    student_name = serializers.CharField(source="project.student.user.get_full_name", read_only=True)
    registration_no = serializers.CharField(source="project.student.registration_no", read_only=True)
    topic_title = serializers.CharField(source="project.topic_title_vi", read_only=True)

    class Meta:
        model = DefenseScheduleSlot
        fields = [
            "id",
            "council",
            "council_name",
            "project",
            "student_name",
            "registration_no",
            "topic_title",
            "order_number",
            "slot_date",
            "start_time",
            "end_time",
            "room"
        ]


class GraduationProjectAdminSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.user.get_full_name", read_only=True)
    student_reg_no = serializers.CharField(source="student.registration_no", read_only=True)
    student_class = serializers.CharField(source="student.department", read_only=True)
    education_program = serializers.CharField(source="student.education_program", read_only=True)
    supervisor_name = serializers.SerializerMethodField()
    reviewer_name = serializers.SerializerMethodField()
    council_name = serializers.CharField(source="council.council_name", read_only=True, default="")
    topic_category_name = serializers.CharField(source="topic_category.name", read_only=True, default="")
    schedule_slot_info = serializers.SerializerMethodField()

    final_score_10 = serializers.FloatField(source="final_grade_summary.final_score_10", read_only=True, default=None)
    final_score_4 = serializers.FloatField(source="final_grade_summary.final_score_4", read_only=True, default=None)
    final_letter_grade = serializers.CharField(source="final_grade_summary.final_letter_grade", read_only=True, default="")
    is_passed = serializers.BooleanField(source="final_grade_summary.is_passed", read_only=True, default=False)

    class Meta:
        model = GraduationProject
        fields = [
            "id",
            "student",
            "student_name",
            "student_reg_no",
            "student_class",
            "education_program",
            "supervisor",
            "supervisor_name",
            "batch",
            "topic_category",
            "topic_category_name",
            "topic_title_vi",
            "topic_title_en",
            "status",
            "topic_review_status",
            "topic_revision_notes",
            "outline_pdf_path",
            "initial_eligibility",
            "ineligibility_reason",
            "gpa_score",
            "debt_credits",
            "supervisor_defense_confirmed",
            "final_academic_eligibility",
            "final_academic_notes",
            "deferral_status",
            "deferral_reason",
            "reviewer",
            "reviewer_name",
            "council",
            "council_name",
            "schedule_slot_info",
            "supervisor_score",
            "reviewer_score",
            "is_eligible_for_defense",
            "final_score_10",
            "final_score_4",
            "final_letter_grade",
            "is_passed",
            "created_at",
            "updated_at"
        ]

    def get_supervisor_name(self, obj):
        if not obj.supervisor:
            return ""
        prefix = f"{obj.supervisor.academic_title} " if obj.supervisor.academic_title else ""
        return f"{prefix}{obj.supervisor.user.get_full_name()}".strip()

    def get_reviewer_name(self, obj):
        if not obj.reviewer:
            return ""
        prefix = f"{obj.reviewer.academic_title} " if obj.reviewer.academic_title else ""
        return f"{prefix}{obj.reviewer.user.get_full_name()}".strip()

    def get_schedule_slot_info(self, obj):
        slot = getattr(obj, "scheduled_defense_slot", None)
        if slot:
            return {
                "order": slot.order_number,
                "date": str(slot.slot_date) if slot.slot_date else "",
                "start": slot.start_time.strftime("%H:%M") if slot.start_time else "",
                "end": slot.end_time.strftime("%H:%M") if slot.end_time else "",
                "room": slot.room
            }
        return None
