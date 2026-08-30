from rest_framework import serializers
from .models import (
    CustomUser,
    AuditLog,
    AcademicBatch,
    CourseClass,
    Student,
    Supervisor,
    SupervisorQuota,
    ProjectTopicArea,
    GraduationProject,
    DefenseCouncil,
    CouncilMember,
    FinalGradeSummary,
    EvaluationPolicy
)

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

    class Meta:
        model = Supervisor
        fields = [
            "id",
            "supervisor_id",
            "academic_title",
            "department_name",
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
                "viet_anh_quota": quota.viet_anh_quota,
                "general_cntt_quota": quota.general_cntt_quota,
                "max_total_quota": quota.max_total_quota,
                "current_assigned": quota.current_assigned,
            }
        return {
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
        return obj.get_full_name() or obj.username

    def get_student_profile(self, obj):
        std = getattr(obj, "admin_student_profile", None)
        if std:
            return StudentDetailSerializer(std).data
        return None

    def get_supervisor_profile(self, obj):
        spv = getattr(obj, "admin_supervisor_profile", None)
        if spv:
            return SupervisorDetailSerializer(spv).data
        return None

    def get_council_roles(self, obj):
        roles = obj.council_roles.all()
        if roles.exists():
            return CouncilRoleDetailSerializer(roles, many=True).data
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

    # Common Profile fields
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=30, required=False, allow_blank=True)

    # Student specific fields
    registration_no = serializers.CharField(max_length=50, required=False, allow_blank=True)
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

    # Supervisor specific fields
    supervisor_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    academic_title = serializers.CharField(max_length=50, required=False, allow_blank=True)
    department_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    is_external = serializers.BooleanField(default=False, required=False)
    max_total_quota = serializers.IntegerField(default=5, required=False)
    viet_anh_quota = serializers.IntegerField(default=2, required=False)
    general_cntt_quota = serializers.IntegerField(default=3, required=False)

    # Council / External Examiner fields
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
        fields = ["id", "batch", "class_code", "class_name", "program_type", "class_group", "student_count"]


class AcademicBatchSerializer(serializers.ModelSerializer):
    classes = CourseClassSerializer(source="course_classes", many=True, read_only=True)
    student_count = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()

    class Meta:
        model = AcademicBatch
        fields = ["id", "batch_code", "batch_name", "start_date", "end_date", "is_active", "created_at", "classes", "student_count", "project_count"]

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

    class Meta:
        model = DefenseCouncil
        fields = ["id", "batch", "council_number", "council_name", "session_date", "session_time", "defense_room", "created_at", "members", "project_count"]

    def get_project_count(self, obj):
        return obj.projects.count()


class GraduationProjectAdminSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.user.get_full_name", read_only=True)
    student_reg_no = serializers.CharField(source="student.registration_no", read_only=True)
    student_class = serializers.CharField(source="student.department", read_only=True)
    supervisor_name = serializers.SerializerMethodField()
    reviewer_name = serializers.SerializerMethodField()
    council_name = serializers.CharField(source="council.council_name", read_only=True, default="")
    topic_category_name = serializers.CharField(source="topic_category.name", read_only=True, default="")
    final_score_10 = serializers.FloatField(source="final_grade_summary.final_score_10", read_only=True, default=None)
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
            "supervisor",
            "supervisor_name",
            "batch",
            "topic_category",
            "topic_category_name",
            "topic_title_vi",
            "topic_title_en",
            "status",
            "reviewer",
            "reviewer_name",
            "council",
            "council_name",
            "supervisor_score",
            "reviewer_score",
            "is_eligible_for_defense",
            "final_score_10",
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
