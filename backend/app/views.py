import logging
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken

from django.conf import settings
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
from .permissions import IsAdminUserRole
from .serializers import (
    AdminUserSerializer,
    AdminRegisterSerializer,
    AdminCreateUserSerializer,
    AuditLogSerializer,
    AcademicBatchSerializer,
    CourseClassSerializer,
    SupervisorQuotaSerializer,
    DefenseCouncilSerializer,
    GraduationProjectAdminSerializer
)
from .services.excel_importer import ExcelImportService
from .services.allocation_engine import MinCostMaxFlowAllocationEngine
from .services.reviewer_engine import ReviewerAndCouncilAllocationEngine
from .services.document_generator import DocumentGenerationService

logger = logging.getLogger(__name__)

def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        key="refresh_token",
        value=str(refresh_token),
        httponly=True,
        secure=False,  # Set to True in production HTTPS
        samesite="Lax",
        path="/app/",
        max_age=7 * 24 * 3600,
    )
    return response


def delete_refresh_cookie(response):
    response.delete_cookie(key="refresh_token", path="/app/")
    return response


class AdminRegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AdminRegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        admin_secret = serializer.validated_data["admin_secret"]
        configured_secret = getattr(settings, "ADMIN_REGISTRATION_SECRET", "")
        if not configured_secret or admin_secret != configured_secret:
            return Response(
                {"detail": "Forbidden: Invalid Admin Registration Secret Key."},
                status=status.HTTP_403_FORBIDDEN
            )

        username = serializer.validated_data["username"].strip()
        email = serializer.validated_data["email"].strip().lower()

        if CustomUser.objects.filter(username=username).exists():
            return Response({"username": ["A user with that username already exists."]}, status=status.HTTP_400_BAD_REQUEST)
        if CustomUser.objects.filter(email=email).exists():
            return Response({"email": ["A user with that email already exists."]}, status=status.HTTP_400_BAD_REQUEST)

        user = CustomUser.objects.create_user(
            username=username,
            email=email,
            password=serializer.validated_data["password"],
            user_type="admin",
            is_staff=True,
            is_active=True
        )

        AuditLog.objects.create(
            user=user,
            action_type="admin_user_update",
            description=f"Admin registered user '{username}'."
        )

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        response = Response({
            "access": access_token,
            "user": AdminUserSerializer(user).data,
            "message": "Admin registration successful."
        }, status=status.HTTP_201_CREATED)

        return set_refresh_cookie(response, refresh)


class AdminLoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")

        if not username or not password:
            return Response({"detail": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        user = CustomUser.objects.filter(username=username).first()
        if not user or not user.check_password(password):
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({"detail": "Account is disabled."}, status=status.HTTP_403_FORBIDDEN)

        if not (user.is_staff or user.is_superuser or user.user_type == "admin"):
            return Response({"detail": "Forbidden: You do not have admin access privileges."}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        AuditLog.objects.create(
            user=user,
            action_type="admin_user_update",
            description=f"Admin '{username}' logged in successfully."
        )

        response = Response({
            "access": access_token,
            "user": AdminUserSerializer(user).data
        }, status=status.HTTP_200_OK)

        return set_refresh_cookie(response, refresh)


class AdminCookieTokenRefreshAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response({"detail": "No refresh token cookie found."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            refresh = RefreshToken(refresh_token)
            user_id = refresh.payload.get("user_id")
            user = CustomUser.objects.filter(id=user_id).first()

            if not user or not user.is_active or not (user.is_staff or user.is_superuser or user.user_type == "admin"):
                response = Response({"detail": "Invalid session or unauthorized."}, status=status.HTTP_403_FORBIDDEN)
                return delete_refresh_cookie(response)

            access_token = str(refresh.access_token)
            return Response({
                "access": access_token,
                "user": AdminUserSerializer(user).data
            }, status=status.HTTP_200_OK)
        except Exception:
            response = Response({"detail": "Token expired or invalid."}, status=status.HTTP_401_UNAUTHORIZED)
            return delete_refresh_cookie(response)


class AdminCookieLogoutAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)
        return delete_refresh_cookie(response)


class AdminUserManagementAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        users = CustomUser.objects.all().order_by("-id")
        user_type = request.query_params.get("user_type")
        search = request.query_params.get("search")

        if user_type:
            users = users.filter(user_type=user_type)
        if search:
            users = users.filter(Q(username__icontains=search) | Q(email__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search))

        serializer = AdminUserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = AdminCreateUserSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        username = serializer.validated_data["username"]
        email = serializer.validated_data["email"]

        if CustomUser.objects.filter(username=username).exists():
            return Response({"username": ["A user with that username already exists."]}, status=status.HTTP_400_BAD_REQUEST)

        user = CustomUser.objects.create_user(
            username=username,
            email=email,
            password=serializer.validated_data["password"],
            user_type=serializer.validated_data["user_type"],
            is_active=serializer.validated_data.get("is_active", True),
            is_staff=True if serializer.validated_data["user_type"] == "admin" else False
        )

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Admin created user '{username}' with role '{user.user_type}'."
        )

        return Response(AdminUserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminSecurityCenterAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        total_users = CustomUser.objects.count()
        admin_count = CustomUser.objects.filter(user_type="admin").count()
        student_count = Student.objects.count()
        supervisor_count = Supervisor.objects.count()
        batches_count = AcademicBatch.objects.count()
        projects_count = GraduationProject.objects.count()
        recent_audits = AuditLogSerializer(AuditLog.objects.all().order_by("-created_at")[:10], many=True).data

        return Response({
            "metrics": {
                "total_users": total_users,
                "admin_count": admin_count,
                "student_count": student_count,
                "supervisor_count": supervisor_count,
                "batches_count": batches_count,
                "projects_count": projects_count,
            },
            "recent_audits": recent_audits
        }, status=status.HTTP_200_OK)


class AdminAuditLogListAPIView(ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all().order_by("-created_at")


class AdminAuditLogStatsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        total = AuditLog.objects.count()
        admin_actions = AuditLog.objects.filter(action_type="admin_user_update").count()
        eval_actions = AuditLog.objects.filter(action_type="evaluation_update").count()
        return Response({
            "total_audit_logs": total,
            "admin_actions_count": admin_actions,
            "evaluation_actions_count": eval_actions
        }, status=status.HTTP_200_OK)


# ==============================================================================
# ACADEMIC BATCH & EXCEL IMPORT VIEWS
# ==============================================================================

class AcademicBatchListCreateAPIView(ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    serializer_class = AcademicBatchSerializer
    queryset = AcademicBatch.objects.all().order_by("-created_at")


class AcademicBatchDetailAPIView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    serializer_class = AcademicBatchSerializer
    queryset = AcademicBatch.objects.all()


class ExcelStudentImportAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        batch_id = request.data.get("batch_id")

        if not file_obj:
            return Response({"detail": "Vui lòng chọn file Excel để import."}, status=status.HTTP_400_BAD_REQUEST)
        if not batch_id:
            return Response({"detail": "Vui lòng chọn Kỳ học / Đợt ĐATN (batch_id)."}, status=status.HTTP_400_BAD_REQUEST)

        res = ExcelImportService.import_students_from_excel(file_obj, batch_id)

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Imported Excel students for Batch #{batch_id}: Total={res.get('total')}, Created={res.get('created')}"
        )

        return Response(res, status=status.HTTP_200_OK if res.get("success") else status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# SUPERVISOR QUOTA & ALLOCATION VIEWS
# ==============================================================================

class SupervisorQuotaListUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        batch_id = request.query_params.get("batch_id")
        quotas = SupervisorQuota.objects.all().select_related("supervisor__user")
        if batch_id:
            quotas = quotas.filter(batch_id=batch_id)
        serializer = SupervisorQuotaSerializer(quotas, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        quotas_data = request.data
        if not isinstance(quotas_data, list):
            return Response({"detail": "Dữ liệu phải là danh sách quota cập nhật."}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = 0
        for item in quotas_data:
            quota_id = item.get("id")
            if quota_id:
                q = SupervisorQuota.objects.filter(id=quota_id).first()
                if q:
                    q.viet_anh_quota = item.get("viet_anh_quota", q.viet_anh_quota)
                    q.general_cntt_quota = item.get("general_cntt_quota", q.general_cntt_quota)
                    q.max_total_quota = item.get("max_total_quota", q.max_total_quota)
                    q.save()
                    updated_count += 1

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Updated quotas for {updated_count} supervisors."
        )

        return Response({"message": f"Cập nhật thành công {updated_count} giảng viên."}, status=status.HTTP_200_OK)


class AutoSupervisorAllocationAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request):
        batch_id = request.data.get("batch_id")
        if not batch_id:
            return Response({"detail": "batch_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        res = MinCostMaxFlowAllocationEngine.allocate_supervisors_for_batch(batch_id)

        AuditLog.objects.create(
            user=request.user,
            action_type="supervisor_request_update",
            description=f"Ran MCMF auto-allocation for Batch #{batch_id}: Matched={res.get('matched_count')}, Unassigned={res.get('unassigned_count')}"
        )

        return Response(res, status=status.HTTP_200_OK if res.get("success") else status.HTTP_400_BAD_REQUEST)


class ManualSupervisorAllocationAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def patch(self, request):
        student_id = request.data.get("student_id")
        supervisor_id = request.data.get("supervisor_id")
        batch_id = request.data.get("batch_id")

        if not student_id or not supervisor_id:
            return Response({"detail": "student_id and supervisor_id are required."}, status=status.HTTP_400_BAD_REQUEST)

        student = get_object_or_404(Student, id=student_id)
        supervisor = get_object_or_404(Supervisor, id=supervisor_id)
        batch = AcademicBatch.objects.filter(id=batch_id).first() or student.academic_batch

        if not batch:
            return Response({"detail": "Sinh viên chưa thuộc đợt đào tạo nào."}, status=status.HTTP_400_BAD_REQUEST)

        proj, created = GraduationProject.objects.update_or_create(
            student=student,
            defaults={
                "supervisor": supervisor,
                "batch": batch,
                "topic_title_vi": f"Đồ án tốt nghiệp của {student.user.get_full_name()}",
                "status": "ALLOCATED"
            }
        )

        # Update quota count
        quota = SupervisorQuota.objects.filter(supervisor=supervisor, batch=batch).first()
        if quota:
            quota.current_assigned = GraduationProject.objects.filter(batch=batch, supervisor=supervisor).count()
            quota.save(update_fields=["current_assigned"])

        AuditLog.objects.create(
            user=request.user,
            action_type="supervisor_request_update",
            description=f"Manual assign student {student.registration_no} to supervisor {supervisor.user.get_full_name()}."
        )

        return Response({
            "message": "Phân công thủ công thành công.",
            "project": GraduationProjectAdminSerializer(proj).data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# DEFENSE COUNCIL & REVIEWER VIEWS
# ==============================================================================

class DefenseCouncilListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        batch_id = request.query_params.get("batch_id")
        councils = DefenseCouncil.objects.all().prefetch_related("members__user", "members__supervisor")
        if batch_id:
            councils = councils.filter(batch_id=batch_id)
        serializer = DefenseCouncilSerializer(councils, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data
        batch_id = data.get("batch_id")
        council_number = data.get("council_number", 1)
        council_name = data.get("council_name", f"Hội đồng {council_number}")
        defense_room = data.get("defense_room", "")
        session_date = data.get("session_date")
        session_time = data.get("session_time", "MORNING")
        members_data = data.get("members", [])

        if not batch_id:
            return Response({"detail": "batch_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        batch = get_object_or_404(AcademicBatch, id=batch_id)
        council = DefenseCouncil.objects.create(
            batch=batch,
            council_number=council_number,
            council_name=council_name,
            defense_room=defense_room,
            session_date=session_date if session_date else None,
            session_time=session_time
        )

        for m in members_data:
            user_id = m.get("user_id")
            role = m.get("role", "MEMBER")
            ext = m.get("external_institution", "")
            if user_id:
                user = CustomUser.objects.filter(id=user_id).first()
                if user:
                    sup = getattr(user, "supervisor_profile", None)
                    CouncilMember.objects.create(
                        council=council,
                        user=user,
                        supervisor=sup,
                        role=role,
                        external_institution=ext
                    )

        return Response(DefenseCouncilSerializer(council).data, status=status.HTTP_201_CREATED)


class AutoReviewerAllocationAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request):
        batch_id = request.data.get("batch_id")
        if not batch_id:
            return Response({"detail": "batch_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        res = ReviewerAndCouncilAllocationEngine.assign_councils_and_reviewers(batch_id)

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Ran No-Conflict Reviewer Allocation for Batch #{batch_id}: Assigned={res.get('assigned_count')}"
        )

        return Response(res, status=status.HTTP_200_OK if res.get("success") else status.HTTP_400_BAD_REQUEST)


class GraduationProjectsAdminListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        batch_id = request.query_params.get("batch_id")
        council_id = request.query_params.get("council_id")
        status_filter = request.query_params.get("status")

        projects = GraduationProject.objects.all().select_related(
            "student__user",
            "supervisor__user",
            "reviewer__user",
            "council",
            "topic_category",
            "final_grade_summary"
        )

        if batch_id:
            projects = projects.filter(batch_id=batch_id)
        if council_id:
            projects = projects.filter(council_id=council_id)
        if status_filter:
            projects = projects.filter(status=status_filter)

        serializer = GraduationProjectAdminSerializer(projects, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ==============================================================================
# DOCUMENT EXPORT API VIEWS (Word .docx & Excel .xlsx)
# ==============================================================================

class ExportToTrinhWordAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        council_id = request.query_params.get("council_id")
        if not council_id:
            return Response({"detail": "council_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            buffer = DocumentGenerationService.generate_to_trinh_docx(council_id)
            response = HttpResponse(
                buffer.getvalue(),
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            response["Content-Disposition"] = f'attachment; filename="To_trinh_Hoi_dong_{council_id}.docx"'
            return response
        except Exception as ex:
            return Response({"detail": f"Error generating document: {str(ex)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExportBienBanExcelAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        council_id = request.query_params.get("council_id")
        if not council_id:
            return Response({"detail": "council_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            buffer = DocumentGenerationService.generate_bien_ban_excel(council_id)
            response = HttpResponse(
                buffer.getvalue(),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            response["Content-Disposition"] = f'attachment; filename="Bien_ban_cham_diem_HD_{council_id}.xlsx"'
            return response
        except Exception as ex:
            return Response({"detail": f"Error generating document: {str(ex)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class HealthCheckAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "healthy", "service": "Smart-Fyp-Admin API"}, status=status.HTTP_200_OK)


class DatabaseHealthCheckAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            user_count = CustomUser.objects.count()
            return Response({"status": "healthy", "database": "connected", "total_users": user_count}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "unhealthy", "database": "error", "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
