import logging
from django.utils import timezone
from django.db import transaction
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
    EvaluationPolicy
)
from .permissions import IsAdminUserRole
from .serializers import (
    AdminUserSerializer,
    AdminRegisterSerializer,
    AdminCreateUserSerializer,
    AdminResetPasswordSerializer,
    AuditLogSerializer,
    AcademicBatchSerializer,
    CourseClassSerializer,
    DepartmentSerializer,
    SupervisorQuotaSerializer,
    SupervisorDetailSerializer,
    DefenseCouncilSerializer,
    DefenseScheduleSlotSerializer,
    GraduationProjectAdminSerializer
)
from .services.excel_importer import ExcelImportService, generate_random_password
from .services.allocation_engine import MinCostMaxFlowAllocationEngine
from .services.reviewer_engine import ReviewerAndCouncilAllocationEngine
from .services.document_generator import DocumentGenerationService
from .services.defense_scheduler import DefenseSchedulerEngine

logger = logging.getLogger(__name__)

def set_refresh_cookie(response, refresh_token):
    is_production = not getattr(settings, "DEBUG", True)
    is_secure = is_production or getattr(settings, "SESSION_COOKIE_SECURE", False)
    response.set_cookie(
        key="refresh_token",
        value=str(refresh_token),
        httponly=True,
        secure=is_secure,
        samesite="None" if is_secure else "Lax",
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
        identifier = (request.data.get("username") or request.data.get("email") or "").strip()
        password = request.data.get("password", "")

        if not identifier or not password:
            return Response({"detail": "Username/email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        user = CustomUser.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()
        if not user or not user.check_password(password):
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        if settings.DEBUG and not user.password.startswith('md5$'):
            user.set_password(password)
            user.save(update_fields=['password'])

        if not user.is_active:
            return Response({"detail": "Account is disabled."}, status=status.HTTP_403_FORBIDDEN)

        if not (user.is_staff or user.is_superuser or user.user_type == "admin"):
            return Response({"detail": "Forbidden: You do not have admin access privileges."}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        AuditLog.objects.create(
            user=user,
            action_type="admin_user_update",
            description=f"Admin '{user.username}' logged in successfully."
        )

        response = Response({
            "access": access_token,
            "user_type": user.user_type,
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
        users = CustomUser.objects.all().select_related(
            "admin_student_profile",
            "admin_student_profile__course_class",
            "admin_student_profile__academic_batch",
            "admin_student_profile__graduation_project",
            "admin_student_profile__graduation_project__supervisor",
            "admin_student_profile__graduation_project__supervisor__user",
            "admin_supervisor_profile"
        ).prefetch_related(
            "council_roles",
            "admin_supervisor_profile__quotas"
        ).order_by("-id")

        # Counts
        total_students = CustomUser.objects.filter(user_type="student").count()
        total_supervisors = CustomUser.objects.filter(user_type="supervisor").count()
        total_committee = CustomUser.objects.filter(user_type="committee_member").count()
        total_external = CustomUser.objects.filter(user_type="external_examiner").count()
        total_admins = CustomUser.objects.filter(user_type="admin").count()
        total_active = CustomUser.objects.filter(is_active=True).count()
        total_deactivated = CustomUser.objects.filter(is_active=False).count()

        # Major counts
        khmt_students_count = Student.objects.filter(
            Q(course_class__program_type="KHMT") | Q(department__icontains="Khoa học máy tính") | Q(department__icontains="KHMT")
        ).count()
        cntt_students_count = max(0, total_students - khmt_students_count)

        # Filters
        user_type = request.query_params.get("user_type") or request.query_params.get("role")
        major = request.query_params.get("major")
        program_type = request.query_params.get("program_type")
        class_id = request.query_params.get("class_id")
        batch_id = request.query_params.get("batch_id")
        supervisor_id = request.query_params.get("supervisor_id")
        has_supervisor = request.query_params.get("has_supervisor")
        is_active = request.query_params.get("is_active")
        search = (request.query_params.get("search") or request.query_params.get("q") or "").strip()

        if user_type:
            users = users.filter(user_type=user_type)

        if major:
            if major.upper() == "KHMT":
                users = users.filter(
                    Q(admin_student_profile__course_class__program_type="KHMT") |
                    Q(admin_student_profile__department__icontains="Khoa học máy tính") |
                    Q(admin_student_profile__department__icontains="KHMT")
                )
            elif major.upper() == "CNTT":
                users = users.exclude(
                    Q(admin_student_profile__course_class__program_type="KHMT") |
                    Q(admin_student_profile__department__icontains="Khoa học máy tính") |
                    Q(admin_student_profile__department__icontains="KHMT")
                )

        if program_type:
            users = users.filter(admin_student_profile__course_class__program_type=program_type)

        if class_id:
            users = users.filter(admin_student_profile__course_class_id=class_id)

        if batch_id:
            users = users.filter(
                Q(admin_student_profile__academic_batch_id=batch_id) |
                Q(admin_supervisor_profile__quotas__batch_id=batch_id)
            ).distinct()

        if supervisor_id:
            if supervisor_id == "unassigned":
                users = users.filter(admin_student_profile__graduation_project__supervisor__isnull=True)
            else:
                users = users.filter(admin_student_profile__graduation_project__supervisor_id=supervisor_id)

        if has_supervisor is not None and has_supervisor != "":
            if str(has_supervisor).lower() in ["true", "1"]:
                users = users.filter(admin_student_profile__graduation_project__supervisor__isnull=False)
            elif str(has_supervisor).lower() in ["false", "0"]:
                users = users.filter(admin_student_profile__graduation_project__supervisor__isnull=True)

        if is_active is not None and is_active != "":
            if str(is_active).lower() in ["true", "1"]:
                users = users.filter(is_active=True)
            elif str(is_active).lower() in ["false", "0"]:
                users = users.filter(is_active=False)

        if search:
            users = users.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(admin_student_profile__registration_no__icontains=search) |
                Q(admin_student_profile__department__icontains=search) |
                Q(admin_student_profile__phone_number__icontains=search) |
                Q(admin_supervisor_profile__supervisor_id__icontains=search) |
                Q(admin_supervisor_profile__department_name__icontains=search) |
                Q(admin_supervisor_profile__academic_title__icontains=search) |
                Q(council_roles__external_institution__icontains=search) |
                Q(council_roles__council__council_name__icontains=search)
            ).distinct()

        total_matched = users.count()
        serializer = AdminUserSerializer(users, many=True)
        return Response({
            "users": serializer.data,
            "total": total_matched,
            "counts": {
                "total": total_students + total_supervisors + total_committee + total_external + total_admins,
                "active": total_active,
                "deactivated": total_deactivated,
                "students": total_students,
                "supervisors": total_supervisors,
                "committee": total_committee,
                "external": total_external,
                "admins": total_admins,
                "cntt_students": cntt_students_count,
                "khmt_students": khmt_students_count,
            }
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = AdminCreateUserSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        user_type = data["user_type"]
        username = data["username"].strip()
        first_name = data.get("first_name", "").strip()
        last_name = data.get("last_name", "").strip()
        phone_number = data.get("phone_number", "").strip()
        is_active = data.get("is_active", True)
        password_strategy = data.get("password_strategy", "MSSV")
        custom_password = data.get("custom_password", "").strip()

        # Check duplicate username
        if CustomUser.objects.filter(username=username).exists():
            return Response({"username": ["Tên đăng nhập này đã tồn tại."]}, status=status.HTTP_400_BAD_REQUEST)

        # Determine password
        if password_strategy == "FIXED" and custom_password:
            plain_password = custom_password
        elif password_strategy == "CUSTOM" and custom_password:
            plain_password = custom_password
        elif password_strategy == "RANDOM":
            plain_password = generate_random_password(8)
        elif data.get("password"):
            plain_password = data["password"]
        else:
            # Default MSSV or username
            plain_password = data.get("registration_no") or username

        # Determine email
        email = data.get("email", "").strip().lower()
        if not email:
            if user_type == "student":
                reg_no = data.get("registration_no") or username
                email = f"{reg_no.lower()}@lms.utc.edu.vn"
            else:
                email = f"{username.lower()}@utc.edu.vn"

        if CustomUser.objects.filter(email=email).exists():
            return Response({"email": ["Email này đã được sử dụng bởi tài khoản khác."]}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = CustomUser.objects.create_user(
                username=username,
                email=email,
                password=plain_password,
                first_name=first_name,
                last_name=last_name,
                user_type=user_type,
                is_active=is_active,
                is_staff=True if user_type == "admin" else False
            )

            # Handle Student Profile
            if user_type == "student":
                reg_no = data.get("registration_no") or username
                class_name = data.get("class_name", "").strip()
                program_type = data.get("program_type", "DAI_TRA")
                course_class_id = data.get("course_class_id")
                academic_batch_id = data.get("academic_batch_id")

                course_class = None
                if course_class_id:
                    course_class = CourseClass.objects.filter(id=course_class_id).first()

                batch = None
                if academic_batch_id:
                    batch = AcademicBatch.objects.filter(id=academic_batch_id).first()
                elif course_class:
                    batch = course_class.batch
                else:
                    batch = AcademicBatch.objects.filter(is_active=True).first()

                Student.objects.create(
                    user=user,
                    registration_no=reg_no,
                    department=class_name or (course_class.class_name if course_class else ""),
                    course_class=course_class,
                    academic_batch=batch,
                    batch_no=class_name,
                    phone_number=phone_number
                )

            # Handle Supervisor Profile
            elif user_type == "supervisor":
                spv_id = data.get("supervisor_id") or username
                academic_title = data.get("academic_title", "").strip()
                department_name = data.get("department_name", "Khoa CNTT - ĐHGTVT").strip()
                is_external = data.get("is_external", False)

                spv = Supervisor.objects.create(
                    user=user,
                    supervisor_id=spv_id,
                    academic_title=academic_title,
                    department_name=department_name,
                    phone_number=phone_number,
                    is_external=is_external
                )

                # Initialize Quota for active batch
                active_batch = AcademicBatch.objects.filter(is_active=True).first()
                if active_batch:
                    SupervisorQuota.objects.create(
                        supervisor=spv,
                        batch=active_batch,
                        department=department_name,
                        viet_anh_quota=data.get("viet_anh_quota", 2),
                        general_cntt_quota=data.get("general_cntt_quota", 3),
                        max_total_quota=data.get("max_total_quota", 5),
                        current_assigned=0
                    )

            AuditLog.objects.create(
                user=request.user,
                action_type="admin_user_update",
                description=f"Admin created {user_type} account '{username}' ({last_name} {first_name})."
            )

        serialized_user = AdminUserSerializer(user).data
        return Response({
            "message": f"Tạo tài khoản {user_type} thành công.",
            "user": serialized_user,
            "plain_password": plain_password
        }, status=status.HTTP_201_CREATED)

    def patch(self, request, pk=None):
        if not pk:
            return Response({"detail": "User ID is required."}, status=status.HTTP_400_BAD_REQUEST)
        user = get_object_or_404(CustomUser, pk=pk)

        is_active = request.data.get("is_active")
        user_type = request.data.get("user_type")
        first_name = request.data.get("first_name")
        last_name = request.data.get("last_name")
        email = request.data.get("email")

        if is_active is not None:
            user.is_active = bool(is_active)
        if user_type:
            user.user_type = user_type
            if user_type == "admin":
                user.is_staff = True
            elif user.id != request.user.id:
                user.is_staff = False
        if first_name is not None:
            user.first_name = first_name.strip()
        if last_name is not None:
            user.last_name = last_name.strip()
        if email:
            user.email = email.strip().lower()

        user.save()

        # Update associated Student profile if any
        if hasattr(user, "admin_student_profile"):
            std = user.admin_student_profile
            phone_number = request.data.get("phone_number")
            class_name = request.data.get("class_name")
            course_class_id = request.data.get("course_class_id")
            academic_batch_id = request.data.get("academic_batch_id")

            if phone_number is not None:
                std.phone_number = phone_number.strip()
            if class_name is not None:
                std.department = class_name.strip()
                std.batch_no = class_name.strip()
            if course_class_id:
                std.course_class_id = course_class_id
            if academic_batch_id:
                std.academic_batch_id = academic_batch_id
            std.save()

        # Update associated Supervisor profile if any
        if hasattr(user, "admin_supervisor_profile"):
            spv = user.admin_supervisor_profile
            academic_title = request.data.get("academic_title")
            department_name = request.data.get("department_name")
            phone_number = request.data.get("phone_number")
            is_external = request.data.get("is_external")

            if academic_title is not None:
                spv.academic_title = academic_title.strip()
            if department_name is not None:
                spv.department_name = department_name.strip()
            if phone_number is not None:
                spv.phone_number = phone_number.strip()
            if is_external is not None:
                spv.is_external = bool(is_external)
            spv.save()

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Admin updated user '{user.username}' status/profile."
        )
        return Response({
            "message": "Cập nhật người dùng thành công.",
            "user": AdminUserSerializer(user).data
        }, status=status.HTTP_200_OK)

    def delete(self, request, pk=None):
        if not pk:
            return Response({"detail": "User ID is required."}, status=status.HTTP_400_BAD_REQUEST)
        user = get_object_or_404(CustomUser, pk=pk)

        if user.id == request.user.id:
            return Response({"detail": "Không thể xóa tài khoản Admin đang đăng nhập."}, status=status.HTTP_400_BAD_REQUEST)

        username = user.username
        user.delete()

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Admin deleted user '{username}'."
        )
        return Response({"message": f"Đã xóa người dùng {username}."}, status=status.HTTP_200_OK)


class AdminImportExcelAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        batch_id = request.data.get("batch_id")
        password_strategy = request.data.get("password_strategy", "MSSV")
        custom_fixed_password = request.data.get("custom_fixed_password", "")
        default_major = request.data.get("default_major", "CNTT")

        if not file_obj:
            return Response({"detail": "Vui lòng chọn file Excel để import."}, status=status.HTTP_400_BAD_REQUEST)
        if not batch_id:
            # Fallback to active batch
            active_batch = AcademicBatch.objects.filter(is_active=True).first()
            if active_batch:
                batch_id = active_batch.id
            else:
                return Response({"detail": "Vui lòng chọn Kỳ học / Đợt ĐATN (batch_id)."}, status=status.HTTP_400_BAD_REQUEST)

        res = ExcelImportService.import_students_from_excel(
            file_obj=file_obj,
            batch_id=batch_id,
            password_strategy=password_strategy,
            custom_fixed_password=custom_fixed_password,
            default_major=default_major
        )

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Imported Excel students for Batch #{batch_id}: Total={res.get('total')}, Created={res.get('created')}, Strategy={password_strategy}"
        )

        return Response(res, status=status.HTTP_200_OK if res.get("success") else status.HTTP_400_BAD_REQUEST)


class AdminDownloadTemplateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        buffer = ExcelImportService.generate_student_template()
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = 'attachment; filename="Mau_Import_Sinh_Vien_UTC.xlsx"'
        return response


class AdminExportUsersExcelAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        users = CustomUser.objects.all().select_related(
            "admin_student_profile",
            "admin_student_profile__course_class",
            "admin_student_profile__academic_batch",
            "admin_student_profile__graduation_project",
            "admin_student_profile__graduation_project__supervisor",
            "admin_student_profile__graduation_project__supervisor__user",
            "admin_supervisor_profile"
        ).order_by("-id")

        user_type = request.query_params.get("user_type") or request.query_params.get("role")
        major = request.query_params.get("major")
        program_type = request.query_params.get("program_type")
        class_id = request.query_params.get("class_id")
        batch_id = request.query_params.get("batch_id")
        supervisor_id = request.query_params.get("supervisor_id")
        search = (request.query_params.get("search") or request.query_params.get("q") or "").strip()

        if user_type:
            users = users.filter(user_type=user_type)
        if major:
            if major.upper() == "KHMT":
                users = users.filter(
                    Q(admin_student_profile__course_class__program_type="KHMT") |
                    Q(admin_student_profile__department__icontains="Khoa học máy tính") |
                    Q(admin_student_profile__department__icontains="KHMT")
                )
            elif major.upper() == "CNTT":
                users = users.exclude(
                    Q(admin_student_profile__course_class__program_type="KHMT") |
                    Q(admin_student_profile__department__icontains="Khoa học máy tính") |
                    Q(admin_student_profile__department__icontains="KHMT")
                )
        if program_type:
            users = users.filter(admin_student_profile__course_class__program_type=program_type)
        if class_id:
            users = users.filter(admin_student_profile__course_class_id=class_id)
        if batch_id:
            users = users.filter(
                Q(admin_student_profile__academic_batch_id=batch_id) |
                Q(admin_supervisor_profile__quotas__batch_id=batch_id)
            ).distinct()
        if supervisor_id:
            if supervisor_id == "unassigned":
                users = users.filter(admin_student_profile__graduation_project__supervisor__isnull=True)
            else:
                users = users.filter(admin_student_profile__graduation_project__supervisor_id=supervisor_id)
        if search:
            users = users.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(admin_student_profile__registration_no__icontains=search) |
                Q(admin_student_profile__department__icontains=search) |
                Q(admin_supervisor_profile__supervisor_id__icontains=search)
            ).distinct()

        buffer = ExcelImportService.export_users_to_excel(users, role=user_type or "all")
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = 'attachment; filename="Danh_Sach_Nguoi_Dung_UTC.xlsx"'
        return response


class AdminResetUserPasswordAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk=None):
        if not pk:
            return Response({"detail": "User ID is required."}, status=status.HTTP_400_BAD_REQUEST)
        user = get_object_or_404(CustomUser, pk=pk)

        serializer = AdminResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        strategy = serializer.validated_data.get("password_strategy", "MSSV")
        custom_pwd = serializer.validated_data.get("custom_password", "").strip()

        if strategy == "MSSV":
            if hasattr(user, "admin_student_profile") and user.admin_student_profile.registration_no:
                new_pwd = user.admin_student_profile.registration_no
            elif hasattr(user, "admin_supervisor_profile") and user.admin_supervisor_profile.supervisor_id:
                new_pwd = user.admin_supervisor_profile.supervisor_id
            else:
                new_pwd = user.username
        elif strategy in ["FIXED", "CUSTOM"] and custom_pwd:
            new_pwd = custom_pwd
        elif strategy == "RANDOM":
            new_pwd = generate_random_password(8)
        else:
            new_pwd = user.username

        user.set_password(new_pwd)
        user.save()

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Admin reset password for user '{user.username}' (Strategy: {strategy})."
        )

        return Response({
            "message": f"Đặt lại mật khẩu thành công cho tài khoản '{user.username}'.",
            "username": user.username,
            "new_password": new_pwd
        }, status=status.HTTP_200_OK)


class AdminSecurityCenterAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        total_users = CustomUser.objects.count()
        active_users = CustomUser.objects.filter(is_active=True).count()
        deactivated_users = CustomUser.objects.filter(is_active=False).count()
        admin_count = CustomUser.objects.filter(user_type="admin").count()
        student_count = Student.objects.count()
        supervisor_count = Supervisor.objects.count()
        batches_count = AcademicBatch.objects.count()
        projects_count = GraduationProject.objects.count()
        councils_count = DefenseCouncil.objects.count()
        recent_audits = AuditLogSerializer(AuditLog.objects.all().order_by("-created_at")[:10], many=True).data

        return Response({
            "metrics": {
                "total_users": total_users,
                "active_users": active_users,
                "deactivated_users": deactivated_users,
                "admin_count": admin_count,
                "student_count": student_count,
                "supervisor_count": supervisor_count,
                "batches_count": batches_count,
                "projects_count": projects_count,
                "councils_count": councils_count,
            },
            "security_headers": {
                "httponly_cookies": True,
                "content_security_policy": True,
                "hsts_production": True,
                "cors_credentials": True,
                "magic_bytes_file_inspection": True,
                "websocket_one_time_tickets": True,
                "jwt_access_expiry_minutes": 15,
                "rate_limiting_active": True,
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
    pagination_class = None


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
                    sup = getattr(user, "admin_supervisor_profile", None) or getattr(user, "supervisor_profile", None)
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
        return Response({"status": "ok", "service": "Smart-Fyp-Admin API"}, status=status.HTTP_200_OK)



class DatabaseHealthCheckAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            user_count = CustomUser.objects.count()
            return Response({"status": "healthy", "database": "connected", "total_users": user_count}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "unhealthy", "database": "error", "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==============================================================================
# DEPARTMENT MANAGEMENT (BỘ MÔN CHUYÊN MÔN - GIAI ĐOẠN 1)
# ==============================================================================

class DepartmentListCreateAPIView(ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    serializer_class = DepartmentSerializer
    queryset = Department.objects.all().order_by("code")
    pagination_class = None


class DepartmentDetailAPIView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    serializer_class = DepartmentSerializer
    queryset = Department.objects.all()


class SupervisorProfileUpdateAPIView(APIView):
    """Cập nhật thông tin học vị, bộ môn, hệ số, hướng nghiên cứu của GV (Bước 7)"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def patch(self, request, pk):
        supervisor = get_object_or_404(Supervisor, pk=pk)
        academic_title = request.data.get("academic_title")
        department_id = request.data.get("department_id")
        rank_multiplier = request.data.get("academic_rank_multiplier")
        research_interest = request.data.get("research_interest")

        if academic_title is not None:
            supervisor.academic_title = academic_title
        if department_id is not None:
            supervisor.department_obj = Department.objects.filter(id=department_id).first()
            if supervisor.department_obj:
                supervisor.department_name = supervisor.department_obj.name
        if rank_multiplier is not None:
            try:
                supervisor.academic_rank_multiplier = float(rank_multiplier)
            except:
                pass
        if research_interest is not None:
            supervisor.research_interest = research_interest

        supervisor.save()

        # Tự động cập nhật hệ số sang SupervisorQuota trong các đợt hiện có
        for q in supervisor.quotas.all():
            q.rank_multiplier = supervisor.academic_rank_multiplier
            q.calculate_capacity()
            q.save()

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Cập nhật hồ sơ học vị/bộ môn của GV {supervisor.user.get_full_name()} (Hệ số={supervisor.academic_rank_multiplier})."
        )

        return Response(SupervisorDetailSerializer(supervisor).data, status=status.HTTP_200_OK)


# ==============================================================================
# ALLOCATION WORKFLOW (CHỐT PHÂN CÔNG & CÔNG BỐ - GIAI ĐOẠN 2 & 3)
# ==============================================================================

class FinalizeAllocationAPIView(APIView):
    """Khoa chốt phân công đề tài (Bước 17)"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request):
        batch_id = request.data.get("batch_id")
        if not batch_id:
            return Response({"detail": "batch_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        res = MinCostMaxFlowAllocationEngine.finalize_allocation(batch_id, user=request.user)
        return Response(res, status=status.HTTP_200_OK if res.get("success") else status.HTTP_400_BAD_REQUEST)


class PublishAllocationAPIView(APIView):
    """Công bố và gửi email kết quả phân công (Bước 18 & 19)"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request):
        batch_id = request.data.get("batch_id")
        if not batch_id:
            return Response({"detail": "batch_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        res = MinCostMaxFlowAllocationEngine.publish_and_notify_allocation(batch_id, user=request.user)
        return Response(res, status=status.HTTP_200_OK if res.get("success") else status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# TOPIC APPROVAL & OUTLINE DOWNLOAD (DUYỆT ĐỀ TÀI - GIAI ĐOẠN 3)
# ==============================================================================

class TopicApprovalAPIView(APIView):
    """Khoa/Ban duyệt đề tài (Bước 22): APPROVE hoặc REQUEST_REVISION"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def patch(self, request, pk):
        project = get_object_or_404(GraduationProject, pk=pk)
        decision = request.data.get("decision")  # "APPROVE" hoặc "REQUEST_REVISION"
        notes = request.data.get("notes", "")

        if decision == "APPROVE":
            project.topic_review_status = "APPROVED"
            project.status = "OUTLINE_APPROVED"
            project.topic_revision_notes = ""
            project.save()

            AuditLog.objects.create(
                user=request.user,
                action_type="document_status_change",
                description=f"Khoa phê duyệt đề tài cho SV {project.student.registration_no} ({project.topic_title_vi})."
            )
            return Response({"message": "Phê duyệt đề tài thành công.", "status": "APPROVED"}, status=status.HTTP_200_OK)

        elif decision == "REQUEST_REVISION":
            project.topic_review_status = "REVISION_REQUIRED"
            project.status = "OUTLINE_REVISION"
            project.topic_revision_notes = notes
            project.save()

            AuditLog.objects.create(
                user=request.user,
                action_type="document_status_change",
                description=f"Khoa yêu cầu sửa đề tài của SV {project.student.registration_no}: {notes}"
            )
            return Response({"message": "Đã gửi yêu cầu chỉnh sửa đề tài về Draft.", "status": "REVISION_REQUIRED"}, status=status.HTTP_200_OK)

        return Response({"detail": "Quyết định không hợp lệ (APPROVE hoặc REQUEST_REVISION)."}, status=status.HTTP_400_BAD_REQUEST)


class DownloadProjectOutlineAPIView(APIView):
    """Giai đoạn 3 (Bước 23): Tải Phiếu giao đề tài & Đề cương đồ án tốt nghiệp"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request, pk):
        try:
            buffer = DocumentGenerationService.generate_outline_docx(pk)
            project = GraduationProject.objects.get(id=pk)
            response = HttpResponse(
                buffer.getvalue(),
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            filename = f"Phieu_giao_de_tai_{project.student.registration_no}.docx"
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response
        except Exception as ex:
            return Response({"detail": f"Error generating document: {str(ex)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==============================================================================
# ELIGIBILITY & FORCE APPROVE (GIAI ĐOẠN 4)
# ==============================================================================

class ExcelEligibilityImportAPIView(APIView):
    """Import điểm / danh sách xét điều kiện làm đồ án (Bước 25 & 26)"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        batch_id = request.data.get("batch_id")

        if not file_obj or not batch_id:
            return Response({"detail": "File Excel và batch_id là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

        res = ExcelImportService.import_eligibility_from_excel(file_obj, batch_id)

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Imported eligibility for Batch #{batch_id}: Processed={res.get('total_processed')}, Eligible={res.get('eligible_count')}"
        )

        return Response(res, status=status.HTTP_200_OK if res.get("success") else status.HTTP_400_BAD_REQUEST)


class EligibilityDecisionAPIView(APIView):
    """Quyết định Force Approve hoặc Loại khỏi đợt (Bước 27)"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def patch(self, request, pk):
        project = get_object_or_404(GraduationProject, pk=pk)
        decision = request.data.get("decision")  # "FORCE_APPROVE" hoặc "DISQUALIFY"
        reason = request.data.get("reason", "")

        if decision == "FORCE_APPROVE":
            project.initial_eligibility = "FORCE_APPROVED"
            project.status = "IN_PROGRESS"
            project.force_approved_by = request.user
            project.force_approved_at = timezone.now()
            project.ineligibility_reason = f"Đặc cách: {reason}" if reason else project.ineligibility_reason
            project.save()

            AuditLog.objects.create(
                user=request.user,
                action_type="evaluation_update",
                description=f"Khoa Force Approve cho SV {project.student.registration_no}: {reason}"
            )
            return Response({"message": "Khoa đã đặc cách cho phép làm đồ án (Force Approve).", "status": "FORCE_APPROVED"}, status=status.HTTP_200_OK)

        elif decision == "DISQUALIFY":
            project.initial_eligibility = "DISQUALIFIED"
            project.status = "DISQUALIFIED"
            project.ineligibility_reason = reason or "Không đủ điều kiện làm đồ án tốt nghiệp"
            project.save()

            AuditLog.objects.create(
                user=request.user,
                action_type="evaluation_update",
                description=f"Khoa loại SV {project.student.registration_no} khỏi đợt đồ án: {reason}"
            )
            return Response({"message": "Đã loại sinh viên khỏi đợt đồ án.", "status": "DISQUALIFIED"}, status=status.HTTP_200_OK)

        return Response({"detail": "Quyết định không hợp lệ (FORCE_APPROVE hoặc DISQUALIFY)."}, status=status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# DEFENSE READINESS, DEFERRAL & SCHEDULING (GIAI ĐOẠN 6 & BẢO LƯU)
# ==============================================================================

class ExcelFinalAcademicImportAPIView(APIView):
    """Import kiểm tra điều kiện học vụ cuối (Bước 36 & 37)"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        batch_id = request.data.get("batch_id")

        if not file_obj or not batch_id:
            return Response({"detail": "File Excel và batch_id là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

        res = ExcelImportService.import_final_academic_status(file_obj, batch_id)

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Imported final academic status for Batch #{batch_id}: Eligible={res.get('eligible_count')}, Ineligible={res.get('ineligible_count')}"
        )

        return Response(res, status=status.HTTP_200_OK if res.get("success") else status.HTTP_400_BAD_REQUEST)


class DeferralDecisionAPIView(APIView):
    """Xử lý Nhánh Bảo lưu (Bước 43): Khoa duyệt bảo lưu hoặc loại khỏi đợt"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def patch(self, request, pk):
        project = get_object_or_404(GraduationProject, pk=pk)
        decision = request.data.get("decision")  # "APPROVE_DEFERRAL" hoặc "REJECT_DEFERRAL"
        reason = request.data.get("reason", "")

        if decision == "APPROVE_DEFERRAL":
            project.deferral_status = "APPROVED"
            project.status = "DEFERRED"
            project.deferral_reason = reason or project.deferral_reason or "Bảo lưu theo quy định học vụ"
            project.deferral_decided_at = timezone.now()
            project.is_eligible_for_defense = False
            project.save()

            AuditLog.objects.create(
                user=request.user,
                action_type="group_status_change",
                description=f"Khoa phê duyệt đơn bảo lưu đồ án cho SV {project.student.registration_no}."
            )
            return Response({"message": "Khoa đã duyệt bảo lưu thành công.", "status": "DEFERRED"}, status=status.HTTP_200_OK)

        elif decision == "REJECT_DEFERRAL":
            project.deferral_status = "REJECTED"
            project.status = "FAILED"
            project.is_eligible_for_defense = False
            project.deferral_reason = reason or "Khoa từ chối đơn bảo lưu -> Không đạt"
            project.deferral_decided_at = timezone.now()
            project.save()

            AuditLog.objects.create(
                user=request.user,
                action_type="group_status_change",
                description=f"Khoa từ chối đơn bảo lưu của SV {project.student.registration_no} -> Loại khỏi đợt."
            )
            return Response({"message": "Đã từ chối đơn bảo lưu và loại khỏi đợt đồ án.", "status": "FAILED"}, status=status.HTTP_200_OK)

        return Response({"detail": "Quyết định không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)


class AutoDefenseScheduleAPIView(APIView):
    """Xếp lịch bảo vệ tự động (Bước 41)"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request):
        batch_id = request.data.get("batch_id")
        slot_duration = int(request.data.get("slot_duration", 40))
        morning_start = request.data.get("morning_start", "08:00")
        afternoon_start = request.data.get("afternoon_start", "13:30")

        if not batch_id:
            return Response({"detail": "batch_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        res = DefenseSchedulerEngine.schedule_defense_for_batch(
            batch_id=batch_id,
            slot_duration_minutes=slot_duration,
            morning_start_str=morning_start,
            afternoon_start_str=afternoon_start,
            user=request.user
        )

        return Response(res, status=status.HTTP_200_OK if res.get("success") else status.HTTP_400_BAD_REQUEST)


class ManualReviewerOverrideAPIView(APIView):
    """Khoa điều chỉnh thủ công Hội đồng & Giảng viên phản biện (Bước 40)"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def patch(self, request):
        project_id = request.data.get("project_id")
        council_id = request.data.get("council_id")
        reviewer_id = request.data.get("reviewer_id")

        if not project_id:
            return Response({"detail": "project_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        res = ReviewerAndCouncilAllocationEngine.manual_override_reviewer(
            project_id=project_id,
            council_id=council_id,
            reviewer_id=reviewer_id,
            user=request.user
        )

        return Response(res, status=status.HTTP_200_OK if res.get("success") else status.HTTP_400_BAD_REQUEST)


class FinalizeCouncilScoresAPIView(APIView):
    """Hội đồng xác nhận chốt điểm (Bước 43)"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        council = get_object_or_404(DefenseCouncil, pk=pk)
        council.is_finalized = True
        council.save()

        # Finalize all summaries
        for proj in council.projects.all():
            summary = getattr(proj, "final_grade_summary", None)
            if summary:
                summary.is_finalized = True
                summary.save(update_fields=["is_finalized"])

        AuditLog.objects.create(
            user=request.user,
            action_type="evaluation_update",
            description=f"Hội đồng {council.council_name} đã xác nhận chốt toàn bộ điểm bảo vệ."
        )

        return Response({"message": f"Đã chốt điểm thành công cho {council.council_name}."}, status=status.HTTP_200_OK)


class CloseBatchAPIView(APIView):
    """Khoa kết thúc đợt đồ án (Bước 46)"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        batch = get_object_or_404(AcademicBatch, pk=pk)
        batch.current_stage = "COMPLETED"
        batch.is_closed = True
        batch.save(update_fields=["current_stage", "is_closed"])

        AuditLog.objects.create(
            user=request.user,
            action_type="group_status_change",
            description=f"Khoa đã chính thức kết thúc Đợt đồ án {batch.batch_code}."
        )

        return Response({"message": f"Đợt {batch.batch_code} đã hoàn tất và kết thúc thành công."}, status=status.HTTP_200_OK)


class ExportFinalSummaryExcelAPIView(APIView):
    """Xuất dữ liệu cuối kỳ - ký (Bước 45)"""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        batch_id = request.query_params.get("batch_id")
        if not batch_id:
            return Response({"detail": "batch_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            buffer = DocumentGenerationService.generate_final_summary_excel(batch_id)
            response = HttpResponse(
                buffer.getvalue(),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            response["Content-Disposition"] = f'attachment; filename="Du_lieu_cuoi_ky_Dot_{batch_id}.xlsx"'
            return response
        except Exception as ex:
            return Response({"detail": f"Error generating document: {str(ex)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

