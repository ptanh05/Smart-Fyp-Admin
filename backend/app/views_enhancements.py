"""
Modular enhancement API views for Smart-Fyp-Admin:
- BatchMilestone CRUD & Seed Default
- Supplementary Registration (Open / Finalize)
- Manual Academic Record Edit & Admin Deferral Creation
- Manual DefenseScheduleSlot CRUD & Conflict Checks
- DefenseMinutesSignature View & Council Reopen/Notify
- Real Security Center (Active Sessions + Revoke + Dynamic Policies + RBAC Matrix)
- TopicArea CRUD
"""
import datetime
from django.core.cache import cache
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AcademicBatch,
    AuditLog,
    BatchMilestone,
    CouncilMember,
    CustomUser,
    DefenseCouncil,
    DefenseMinutesSignature,
    DefenseScheduleSlot,
    GraduationProject,
    InternshipInfo,
    Notification,
    ProjectTopicArea,
    SecurityPolicy,
    Student,
    StudentPreference,
    Supervisor,
    SupervisorQuota,
    ThesisDeferralRequest,
    UserSessionLog,
)
from .permissions import IsAdminUserRole, IsSuperAdminOnly
from .serializers import (
    AcademicBatchSerializer,
    BatchMilestoneSerializer,
    DefenseScheduleSlotSerializer,
    GraduationProjectAdminSerializer,
    ProjectTopicAreaSerializer,
    ThesisDeferralRequestSerializer,
)
from .services.allocation_engine import MinCostMaxFlowAllocationEngine


from .services.batch_progress import DEFAULT_STAGE_MILESTONES, seed_default_milestones_for_batch


def _invalidate_batch_caches():
    for key in ("admin_academic_batches_list", "admin_security_metrics_cache", "utc_active_topic_areas_data"):
        try:
            cache.delete(key)
        except Exception:
            pass


# ==============================================================================
# 1. BATCH MILESTONES CRUD & SEED
# ==============================================================================

class BatchMilestoneListCreateAPIView(APIView):
    """Quản lý danh sách và tạo mới mốc thời gian (Timeline) của một đợt đồ án."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request, batch_id):
        batch = get_object_or_404(AcademicBatch, pk=batch_id)
        milestones = BatchMilestone.objects.filter(batch=batch).select_related("batch").order_by("order_index", "start_date", "id")
        return Response(BatchMilestoneSerializer(milestones, many=True).data, status=status.HTTP_200_OK)

    def post(self, request, batch_id):
        batch = get_object_or_404(AcademicBatch, pk=batch_id)
        if batch.is_closed or batch.current_stage == "COMPLETED":
            return Response(
                {"detail": "Đợt đã kết thúc. Không thể thêm mốc thời gian khi đợt đang đóng."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        payload = dict(request.data)
        payload["batch"] = batch.id
        if not payload.get("order_index"):
            payload["order_index"] = BatchMilestone.objects.filter(batch=batch).count() + 1

        serializer = BatchMilestoneSerializer(data=payload)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        milestone = serializer.save()
        AuditLog.objects.create(
            user=request.user,
            action_type="group_status_change",
            description=f"Khoa tạo mốc thời gian '{milestone.name}' (GĐ{milestone.stage_number}) cho đợt {batch.batch_code}.",
        )
        _invalidate_batch_caches()
        return Response(BatchMilestoneSerializer(milestone).data, status=status.HTTP_201_CREATED)


class BatchMilestoneDetailAPIView(APIView):
    """Xem, cập nhật hoặc xóa một mốc thời gian (Timeline Milestone)."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request, pk):
        milestone = get_object_or_404(BatchMilestone, pk=pk)
        return Response(BatchMilestoneSerializer(milestone).data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        milestone = get_object_or_404(BatchMilestone, pk=pk)
        if milestone.batch and (milestone.batch.is_closed or milestone.batch.current_stage == "COMPLETED"):
            return Response(
                {"detail": "Đợt đã kết thúc. Không thể chỉnh sửa mốc thời gian khi đợt đang đóng."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = BatchMilestoneSerializer(milestone, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        updated = serializer.save()
        AuditLog.objects.create(
            user=request.user,
            action_type="group_status_change",
            description=f"Khoa cập nhật mốc thời gian '{updated.name}' (ID #{updated.id}).",
        )
        _invalidate_batch_caches()
        return Response(BatchMilestoneSerializer(updated).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        return self.patch(request, pk)

    def delete(self, request, pk):
        milestone = get_object_or_404(BatchMilestone, pk=pk)
        if milestone.batch and (milestone.batch.is_closed or milestone.batch.current_stage == "COMPLETED"):
            return Response(
                {"detail": "Đợt đã kết thúc. Không thể xóa mốc thời gian khi đợt đang đóng."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        name = milestone.name
        milestone.delete()
        AuditLog.objects.create(
            user=request.user,
            action_type="group_status_change",
            description=f"Khoa đã xóa mốc thời gian '{name}' (ID #{pk}).",
        )
        _invalidate_batch_caches()
        return Response({"message": f"Đã xóa mốc thời gian '{name}'."}, status=status.HTTP_200_OK)


class BatchMilestoneSeedDefaultAPIView(APIView):
    """Tạo nhanh bộ 6 mốc thời gian chuẩn UTC cho đợt đồ án."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, batch_id):
        batch = get_object_or_404(AcademicBatch, pk=batch_id)
        if batch.is_closed or batch.current_stage == "COMPLETED":
            return Response(
                {"detail": "Đợt đã kết thúc. Không thể khởi tạo mốc thời gian khi đợt đang đóng."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        replace = str(request.data.get("replace", "")).lower() in ("1", "true", "yes")
        if not replace and BatchMilestone.objects.filter(batch=batch).exists():
            return Response(
                {"detail": "Đợt này đã có mốc thời gian. Dùng replace=true nếu muốn tạo lại từ đầu."},
                status=status.HTTP_409_CONFLICT,
            )

        created = seed_default_milestones_for_batch(batch, replace=replace)

        AuditLog.objects.create(
            user=request.user,
            action_type="group_status_change",
            description=f"Khoa đã khởi tạo 6 mốc thời gian mặc định (tỉ lệ theo lịch đợt) cho đợt {batch.batch_code}.",
        )
        _invalidate_batch_caches()
        return Response(BatchMilestoneSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


# ==============================================================================
# 2. SUPPLEMENTARY REGISTRATION (MỞ / CHỐT ĐĂNG KÝ BỔ SUNG)
# ==============================================================================

class OpenSupplementaryRegistrationAPIView(APIView):
    """Mở lại đợt đăng ký nguyện vọng bổ sung cho SV chưa có GVHD mà không xáo trộn SV đã phân công."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, batch_id):
        batch = get_object_or_404(AcademicBatch, pk=batch_id)
        if batch.is_closed or batch.current_stage == "COMPLETED":
            return Response(
                {"detail": "Đợt đồ án đã kết thúc. Vui lòng mở lại đợt trước khi mở đăng ký bổ sung."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if batch.current_stage in ("PHASE_1_SETUP", "PHASE_5_IN_PROGRESS", "PHASE_6_DEFENSE"):
            return Response(
                {
                    "detail": (
                        "Chỉ có thể mở đăng ký bổ sung GVHD ở Giai đoạn 2, Giai đoạn 3 hoặc Giai đoạn 4 "
                        "(trước khi bước vào GĐ 5 Thực hiện đồ án)."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch.supplementary_open = True
        batch.save(update_fields=["supplementary_open"])

        assigned_student_ids = GraduationProject.objects.filter(
            batch=batch, supervisor__isnull=False
        ).values_list("student_id", flat=True)
        unassigned_students = list(
            Student.objects.filter(academic_batch=batch, user__is_active=True)
            .exclude(id__in=assigned_student_ids)
            .select_related("user")
        )

        try:
            notifs = [
                Notification(
                    user=st.user,
                    title=f"[Mở đăng ký nguyện vọng bổ sung] Đợt {batch.batch_code}",
                    message=(
                        f"Khoa đã mở đăng ký nguyện vọng GVHD bổ sung cho đợt {batch.batch_name}. "
                        "Sinh viên chưa có GVHD vui lòng vào mục Khảo sát & Nguyện vọng để cập nhật."
                    ),
                    notification_type="general",
                    action_url="/student/dashboard?tab=utc_graduation&subtab=survey",
                )
                for st in unassigned_students
                if st.user_id
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception:
            pass

        AuditLog.objects.create(
            user=request.user,
            action_type="supervisor_request_update",
            description=(
                f"Khoa đã mở đăng ký bổ sung GVHD cho đợt {batch.batch_code} "
                f"({len(unassigned_students)} SV chưa có GVHD)."
            ),
        )
        _invalidate_batch_caches()
        return Response(
            {
                "success": True,
                "message": f"Đã mở đăng ký bổ sung cho đợt {batch.batch_code} ({len(unassigned_students)} SV chưa có GVHD).",
                "supplementary_open": True,
                "unassigned_count": len(unassigned_students),
                "batch": AcademicBatchSerializer(batch).data,
            },
            status=status.HTTP_200_OK,
        )


class FinalizeSupplementaryRegistrationAPIView(APIView):
    """Chốt đợt đăng ký bổ sung: chạy MCMF cho riêng SV chưa có GVHD và tắt supplementary_open."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, batch_id):
        batch = get_object_or_404(AcademicBatch, pk=batch_id)
        run_auto_allocate = request.data.get("run_auto_allocate", True)
        if isinstance(run_auto_allocate, str):
            run_auto_allocate = run_auto_allocate.lower() in ("true", "1", "yes")

        alloc_result = {
            "success": True,
            "matched_count": 0,
            "preserved_count": 0,
            "newly_matched_count": 0,
            "unassigned_count": 0,
        }
        if run_auto_allocate:
            alloc_result = MinCostMaxFlowAllocationEngine.allocate_supervisors_for_batch(
                batch.id, only_unassigned=True
            )
            if not alloc_result.get("success"):
                return Response(
                    {
                        "success": False,
                        "detail": alloc_result.get("error") or "Không thể chạy phân công bổ sung.",
                        "allocation": alloc_result,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        batch.supplementary_open = False
        batch.save(update_fields=["supplementary_open"])

        AuditLog.objects.create(
            user=request.user,
            action_type="supervisor_request_update",
            description=(
                f"Khoa đã chốt đăng ký bổ sung cho đợt {batch.batch_code}. "
                f"Ghép mới: {alloc_result.get('newly_matched_count', 0)}, "
                f"Bảo toàn: {alloc_result.get('preserved_count', 0)}, "
                f"Còn thiếu: {alloc_result.get('unassigned_count', 0)}."
            ),
        )
        _invalidate_batch_caches()
        return Response(
            {
                "success": True,
                "message": (
                    f"Đã chốt đăng ký bổ sung (Ghép mới {alloc_result.get('newly_matched_count', 0)} SV, "
                    f"bảo toàn {alloc_result.get('preserved_count', 0)} SV cũ)."
                ),
                "supplementary_open": False,
                "allocation": alloc_result,
                "batch": AcademicBatchSerializer(batch).data,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# 3. MANUAL ACADEMIC RECORD EDIT & ADMIN DEFERRAL CREATION
# ==============================================================================

class AdminEditAcademicRecordAPIView(APIView):
    """Admin chỉnh sửa trực tiếp GPA/CPA, số TC nợ và kết luận điều kiện học vụ (không cần re-import Excel)."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    ALLOWED_INITIAL = {"PENDING", "ELIGIBLE", "INELIGIBLE", "FORCE_APPROVED", "DISQUALIFIED"}
    ALLOWED_FINAL = {"PENDING", "ELIGIBLE", "INELIGIBLE"}

    def patch(self, request, pk):
        try:
            abs_pk = abs(int(pk))
        except (ValueError, TypeError):
            abs_pk = pk

        project = GraduationProject.objects.filter(
            Q(pk=abs_pk) | Q(student_id=abs_pk) | Q(student__user_id=abs_pk)
        ).first()
        if not project:
            student = Student.objects.filter(Q(pk=abs_pk) | Q(user_id=abs_pk)).first()
            if not student:
                return Response(
                    {"detail": "Không tìm thấy hồ sơ đồ án hoặc sinh viên tương ứng."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            batch_id = request.data.get("batch_id")
            batch = AcademicBatch.objects.filter(pk=batch_id).first() if batch_id else (
                student.academic_batch or AcademicBatch.objects.filter(is_active=True).first()
            )
            project = GraduationProject.objects.create(
                student=student,
                batch=batch,
                status="ALLOCATED",
                initial_eligibility="PENDING",
            )

        data = request.data
        update_fields = []

        if "gpa_score" in data and data.get("gpa_score") not in (None, ""):
            try:
                gpa = float(data.get("gpa_score"))
            except (TypeError, ValueError):
                return Response({"detail": "gpa_score phải là số thực."}, status=status.HTTP_400_BAD_REQUEST)
            if gpa < 0.0 or gpa > 4.0:
                return Response({"detail": "GPA/CPA phải nằm trong khoảng 0.0 đến 4.0."}, status=status.HTTP_400_BAD_REQUEST)
            project.gpa_score = round(gpa, 2)
            update_fields.append("gpa_score")

        if "debt_credits" in data and data.get("debt_credits") not in (None, ""):
            try:
                debt = int(data.get("debt_credits"))
            except (TypeError, ValueError):
                return Response({"detail": "debt_credits phải là số nguyên."}, status=status.HTTP_400_BAD_REQUEST)
            if debt < 0:
                return Response({"detail": "Số tín chỉ nợ không được âm."}, status=status.HTTP_400_BAD_REQUEST)
            project.debt_credits = debt
            update_fields.append("debt_credits")

        if "ineligibility_reason" in data:
            project.ineligibility_reason = str(data.get("ineligibility_reason") or "").strip()
            update_fields.append("ineligibility_reason")

        if "final_academic_eligibility" in data and data.get("final_academic_eligibility"):
            final_val = str(data.get("final_academic_eligibility")).strip().upper()
            if final_val not in self.ALLOWED_FINAL:
                return Response({"detail": "final_academic_eligibility không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)
            project.final_academic_eligibility = final_val
            update_fields.append("final_academic_eligibility")

        if "final_academic_notes" in data:
            project.final_academic_notes = str(data.get("final_academic_notes") or "").strip()
            update_fields.append("final_academic_notes")

        explicit_initial = data.get("initial_eligibility")
        auto_eval = data.get("auto_evaluate", explicit_initial is None)
        if isinstance(auto_eval, str):
            auto_eval = auto_eval.lower() in ("true", "1", "yes")

        if explicit_initial:
            init_val = str(explicit_initial).strip().upper()
            if init_val not in self.ALLOWED_INITIAL:
                return Response({"detail": "initial_eligibility không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)
            project.initial_eligibility = init_val
            update_fields.append("initial_eligibility")
            if init_val in ("ELIGIBLE", "FORCE_APPROVED") and project.status in ("ALLOCATED", "TOPIC_PENDING", "TOPIC_APPROVED", "OUTLINE_PENDING", "OUTLINE_APPROVED"):
                project.status = "IN_PROGRESS"
                update_fields.append("status")
            elif init_val == "DISQUALIFIED":
                project.status = "DISQUALIFIED"
                update_fields.append("status")
            elif init_val == "INELIGIBLE" and project.status == "IN_PROGRESS":
                project.status = "OUTLINE_APPROVED"
                update_fields.append("status")
        elif auto_eval and ("debt_credits" in update_fields or "gpa_score" in update_fields):
            debt = int(project.debt_credits or 0)
            if debt < 10:
                project.initial_eligibility = "ELIGIBLE"
                if "ineligibility_reason" not in update_fields or not project.ineligibility_reason:
                    project.ineligibility_reason = f"Nợ {debt} tín chỉ (< 10 TC) - Đủ điều kiện làm đồ án"
                    update_fields.append("ineligibility_reason")
                if project.status in ("ALLOCATED", "TOPIC_PENDING", "TOPIC_APPROVED", "OUTLINE_PENDING", "OUTLINE_APPROVED"):
                    project.status = "IN_PROGRESS"
                    update_fields.append("status")
            else:
                project.initial_eligibility = "INELIGIBLE"
                if "ineligibility_reason" not in update_fields or not project.ineligibility_reason:
                    project.ineligibility_reason = f"Nợ {debt} tín chỉ (>= 10 TC theo quy định), chờ Ban Chủ nhiệm Khoa xét Force Approve hoặc Loại"
                    update_fields.append("ineligibility_reason")
                if project.status == "IN_PROGRESS":
                    project.status = "OUTLINE_APPROVED"
                    update_fields.append("status")
            update_fields.append("initial_eligibility")

        if update_fields:
            project.save(update_fields=list(dict.fromkeys(update_fields)))

        st_reg = project.student.registration_no if project.student_id else f"#{project.id}"
        AuditLog.objects.create(
            user=request.user,
            action_type="evaluation_update",
            description=(
                f"Khoa chỉnh sửa học vụ SV {st_reg}: CPA={project.gpa_score}, "
                f"Nợ={project.debt_credits} TC, Kết luận={project.initial_eligibility}."
            ),
        )
        _invalidate_batch_caches()
        return Response(
            {
                "message": "Cập nhật thông tin học vụ thành công.",
                "project": GraduationProjectAdminSerializer(project, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminDeferralListCreateAPIView(APIView):
    """Khoa/Admin xem toàn bộ đơn bảo lưu hoặc lập đơn bảo lưu hộ sinh viên."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        batch_id = request.query_params.get("batch_id")
        status_filter = request.query_params.get("status")
        qs = ThesisDeferralRequest.objects.select_related(
            "student__user", "project__supervisor__user", "project__batch"
        ).order_by("-submitted_at")
        if batch_id:
            qs = qs.filter(Q(project__batch_id=batch_id) | Q(student__academic_batch_id=batch_id))
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        return Response(ThesisDeferralRequestSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        project_id = request.data.get("project_id")
        student_id = request.data.get("student_id")
        reason = (request.data.get("reason") or request.data.get("reason_details") or "").strip()
        admin_notes = (request.data.get("admin_notes") or "").strip()
        auto_approve = request.data.get("auto_approve", False)
        if isinstance(auto_approve, str):
            auto_approve = auto_approve.lower() in ("true", "1", "yes")

        if not reason:
            return Response({"detail": "Vui lòng nhập lý do bảo lưu."}, status=status.HTTP_400_BAD_REQUEST)

        project = None
        if project_id:
            try:
                pid = abs(int(project_id))
            except (TypeError, ValueError):
                pid = project_id
            project = GraduationProject.objects.filter(Q(pk=pid) | Q(student_id=pid)).first()

        student = project.student if project else None
        if not student and student_id:
            student = Student.objects.filter(Q(pk=student_id) | Q(user_id=student_id)).first()

        if not student:
            return Response({"detail": "Không tìm thấy sinh viên hoặc hồ sơ đồ án."}, status=status.HTTP_404_NOT_FOUND)

        if not project:
            project = GraduationProject.objects.filter(student=student).first()
        if not project:
            batch = student.academic_batch or AcademicBatch.objects.filter(is_active=True).first()
            if not batch:
                return Response({"detail": "Sinh viên chưa thuộc đợt đồ án hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)
            project = GraduationProject.objects.create(student=student, batch=batch, status="ALLOCATED")

        with transaction.atomic():
            req_status = "APPROVED" if auto_approve else "PENDING"
            deferral = ThesisDeferralRequest.objects.create(
                project=project,
                student=student,
                reason=reason,
                admin_notes=admin_notes,
                status=req_status,
                created_by_admin=True,
                reviewed_by=request.user if auto_approve else None,
                reviewed_at=timezone.now() if auto_approve else None,
            )
            if auto_approve:
                project.deferral_status = "APPROVED"
                project.status = "DEFERRED"
                project.deferral_reason = reason
                project.deferral_decided_at = timezone.now()
                project.is_eligible_for_defense = False
                project.save(
                    update_fields=[
                        "deferral_status",
                        "status",
                        "deferral_reason",
                        "deferral_decided_at",
                        "is_eligible_for_defense",
                    ]
                )

        try:
            Notification.objects.create(
                user=student.user,
                title="[Thông báo đơn bảo lưu đồ án]",
                message=(
                    f"Khoa đã lập hồ sơ bảo lưu đồ án cho bạn ({'Đã duyệt bảo lưu' if auto_approve else 'Đang chờ xử lý'}): {reason}"
                ),
                notification_type="general",
                action_url="/student/dashboard?tab=utc_graduation",
            )
        except Exception:
            pass

        AuditLog.objects.create(
            user=request.user,
            action_type="group_status_change",
            description=(
                f"Khoa lập đơn bảo lưu hộ SV {student.registration_no} "
                f"(auto_approve={auto_approve}): {reason}"
            ),
        )
        _invalidate_batch_caches()
        return Response(
            {
                "success": True,
                "message": "Đã tạo hồ sơ bảo lưu đồ án thành công.",
                "deferral": ThesisDeferralRequestSerializer(deferral).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ==============================================================================
# 4. MANUAL DEFENSE SCHEDULE SLOTS, REOPEN/NOTIFY & MINUTES SIGNATURES
# ==============================================================================

def _parse_date_value(val):
    if not val:
        return None
    if isinstance(val, datetime.date) and not isinstance(val, datetime.datetime):
        return val
    try:
        return datetime.date.fromisoformat(str(val).strip()[:10])
    except ValueError:
        return None


def _parse_time_value(val):
    if not val:
        return None
    if isinstance(val, datetime.time):
        return val
    s = str(val).strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    return None


def _validate_slot_conflicts(council, project, slot_date, start_time, end_time, room, exclude_slot_id=None):
    if not start_time or not end_time:
        return "Vui lòng nhập đầy đủ giờ bắt đầu và giờ kết thúc."
    if start_time >= end_time:
        return "Giờ kết thúc phải lớn hơn giờ bắt đầu."
    if not slot_date:
        return "Vui lòng chọn ngày bảo vệ hợp lệ (YYYY-MM-DD)."

    council_members = list(council.members.select_related("user", "supervisor").all())
    member_user_ids = {m.user_id for m in council_members if m.user_id}

    # COI: SV GVHD không được nằm trong Hội đồng chấm SV đó
    if project and project.supervisor_id and project.supervisor.user_id in member_user_ids:
        sup_name = project.supervisor.user.get_full_name() or project.supervisor.user.username
        return f"Xung đột lợi ích (COI): GVHD {sup_name} đang là thành viên của {council.council_name}."

    overlapping_qs = DefenseScheduleSlot.objects.filter(
        slot_date=slot_date,
        start_time__lt=end_time,
        end_time__gt=start_time,
    ).select_related("council", "project__student__user")
    if exclude_slot_id:
        overlapping_qs = overlapping_qs.exclude(pk=exclude_slot_id)

    norm_room = (room or "").strip().lower()
    for other in overlapping_qs:
        other_room = (other.room or "").strip().lower()
        if norm_room and other_room and norm_room == other_room:
            st_reg = other.project.student.registration_no if (other.project and other.project.student_id) else f"#{other.project_id}"
            return (
                f"Xung đột phòng bảo vệ: Phòng {room} đã có lịch bảo vệ ({st_reg}, "
                f"{other.start_time.strftime('%H:%M')} - {other.end_time.strftime('%H:%M')})."
            )
        if other.council_id and other.council_id != council.id and member_user_ids:
            other_member_uids = set(
                CouncilMember.objects.filter(council_id=other.council_id).values_list("user_id", flat=True)
            )
            overlap_uids = member_user_ids & other_member_uids
            if overlap_uids:
                u = CustomUser.objects.filter(id__in=overlap_uids).first()
                uname = u.get_full_name() if u else "Thành viên HĐ"
                return (
                    f"Xung đột lịch giảng viên: {uname} đang trùng ca chấm ở {other.council.council_name} "
                    f"({other.start_time.strftime('%H:%M')} - {other.end_time.strftime('%H:%M')})."
                )
    return None


class AdminDefenseScheduleSlotListCreateAPIView(APIView):
    """Danh sách & tạo mới thủ công một Slot lịch bảo vệ có kiểm tra trùng phòng / trùng giờ / COI."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        batch_id = request.query_params.get("batch_id")
        council_id = request.query_params.get("council_id")
        qs = DefenseScheduleSlot.objects.select_related(
            "council", "project__student__user"
        ).order_by("slot_date", "start_time", "order_number", "id")
        if batch_id:
            qs = qs.filter(council__batch_id=batch_id)
        if council_id:
            qs = qs.filter(council_id=council_id)
        return Response(DefenseScheduleSlotSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data
        project_id = data.get("project") or data.get("project_id")
        council_id = data.get("council") or data.get("council_id")
        if not project_id:
            return Response({"detail": "project là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(GraduationProject.objects.select_related("student__user", "supervisor__user"), pk=project_id)
        council = get_object_or_404(DefenseCouncil, pk=council_id) if council_id else project.council
        if not council:
            return Response({"detail": "Vui lòng chọn Hội đồng cho lịch bảo vệ."}, status=status.HTTP_400_BAD_REQUEST)
        if council.is_finalized:
            return Response({"detail": f"{council.council_name} đã chốt điểm nên không thể thêm lịch."}, status=status.HTTP_400_BAD_REQUEST)
        if DefenseScheduleSlot.objects.filter(project=project).exists():
            return Response({"detail": "Sinh viên này đã có slot lịch bảo vệ. Vui lòng chỉnh sửa slot hiện có."}, status=status.HTTP_409_CONFLICT)

        slot_date = _parse_date_value(data.get("slot_date") or council.session_date)
        start_time = _parse_time_value(data.get("start_time"))
        end_time = _parse_time_value(data.get("end_time"))
        room = (data.get("room") if "room" in data else council.defense_room) or ""
        order_number = int(data.get("order_number") or (DefenseScheduleSlot.objects.filter(council=council).count() + 1))

        conflict_err = _validate_slot_conflicts(council, project, slot_date, start_time, end_time, room)
        if conflict_err:
            return Response({"detail": conflict_err, "error": conflict_err}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            slot = DefenseScheduleSlot.objects.create(
                council=council,
                project=project,
                order_number=order_number,
                slot_date=slot_date,
                start_time=start_time,
                end_time=end_time,
                room=room.strip(),
            )
            if project.council_id != council.id:
                project.council = council
                project.save(update_fields=["council"])

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=(
                f"Xếp lịch bảo vệ thủ công cho SV {project.student.registration_no} "
                f"tại {council.council_name} ({slot_date} {start_time}-{end_time}, phòng {room})."
            ),
        )
        return Response(DefenseScheduleSlotSerializer(slot).data, status=status.HTTP_201_CREATED)


class AdminDefenseScheduleSlotDetailAPIView(APIView):
    """Chỉnh sửa hoặc xóa một Slot lịch bảo vệ cụ thể."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def patch(self, request, pk):
        slot = get_object_or_404(
            DefenseScheduleSlot.objects.select_related("council", "project__student__user", "project__supervisor__user"),
            pk=pk,
        )
        if slot.council.is_finalized:
            return Response({"detail": f"{slot.council.council_name} đã chốt điểm nên không thể chỉnh sửa lịch."}, status=status.HTTP_400_BAD_REQUEST)

        data = request.data
        council = get_object_or_404(DefenseCouncil, pk=data.get("council") or data.get("council_id")) if (data.get("council") or data.get("council_id")) else slot.council
        if council.is_finalized:
            return Response({"detail": f"{council.council_name} đã chốt điểm nên không thể chuyển slot sang."}, status=status.HTTP_400_BAD_REQUEST)

        slot_date = _parse_date_value(data["slot_date"]) if "slot_date" in data else slot.slot_date
        start_time = _parse_time_value(data["start_time"]) if "start_time" in data else slot.start_time
        end_time = _parse_time_value(data["end_time"]) if "end_time" in data else slot.end_time
        room = (data.get("room") if "room" in data else slot.room) or ""
        order_number = int(data.get("order_number", slot.order_number))

        conflict_err = _validate_slot_conflicts(
            council, slot.project, slot_date, start_time, end_time, room, exclude_slot_id=slot.id
        )
        if conflict_err:
            return Response({"detail": conflict_err, "error": conflict_err}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            slot.council = council
            slot.slot_date = slot_date
            slot.start_time = start_time
            slot.end_time = end_time
            slot.room = room.strip()
            slot.order_number = order_number
            slot.save()
            if slot.project.council_id != council.id:
                slot.project.council = council
                slot.project.save(update_fields=["council"])

        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Cập nhật lịch bảo vệ #{slot.id} ({slot.council.council_name}, phòng {slot.room}).",
        )
        return Response(DefenseScheduleSlotSerializer(slot).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        slot = get_object_or_404(DefenseScheduleSlot.objects.select_related("council", "project__student"), pk=pk)
        if slot.council.is_finalized:
            return Response({"detail": f"{slot.council.council_name} đã chốt điểm nên không thể xóa lịch."}, status=status.HTTP_400_BAD_REQUEST)
        st_reg = slot.project.student.registration_no if (slot.project and slot.project.student_id) else f"#{slot.id}"
        slot.delete()
        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Xóa slot lịch bảo vệ #{pk} của SV {st_reg}.",
        )
        return Response({"message": "Đã xóa slot lịch bảo vệ."}, status=status.HTTP_200_OK)


class CouncilReopenAndNotifyAPIView(APIView):
    """Mở khóa hội đồng (khi chưa đóng đợt) và gửi thông báo lịch bảo vệ tới thành viên & sinh viên."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        council = get_object_or_404(DefenseCouncil.objects.select_related("batch"), pk=pk)
        do_reopen = request.data.get("reopen", council.is_finalized)
        do_notify = request.data.get("notify", True)
        if isinstance(do_reopen, str):
            do_reopen = do_reopen.lower() in ("true", "1", "yes")
        if isinstance(do_notify, str):
            do_notify = do_notify.lower() in ("true", "1", "yes")

        if do_reopen and council.batch and council.batch.is_closed:
            return Response(
                {"detail": "Đợt đồ án đã đóng, không thể mở khóa Hội đồng."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reopened = False
        if do_reopen and council.is_finalized:
            council.is_finalized = False
            council.save(update_fields=["is_finalized"])
            reopened = True

        notified_count = 0
        if do_notify:
            member_uids = [m.user_id for m in council.members.all() if m.user_id]
            proj_student_uids = [
                p.student.user_id
                for p in council.projects.select_related("student").all()
                if p.student and p.student.user_id
            ]
            date_str = str(council.session_date) if council.session_date else "chưa ấn định ngày"
            room_str = council.defense_room or "chưa gán phòng"
            ca_str = "Ca Sáng" if council.session_time == "MORNING" else "Ca Chiều"
            notifs = []
            for uid in set(member_uids):
                notifs.append(
                    Notification(
                        user_id=uid,
                        title=f"[Thông báo lịch Hội đồng] {council.council_name}",
                        message=(
                            f"Hội đồng {council.council_name} dự kiến bảo vệ ngày {date_str} ({ca_str}) "
                            f"tại phòng {room_str}. {'Hội đồng vừa được mở khóa để cập nhật/chấm điểm.' if reopened else ''}"
                        ).strip(),
                        notification_type="general",
                        action_url="/supervisor/dashboard",
                    )
                )
            for uid in set(proj_student_uids):
                notifs.append(
                    Notification(
                        user_id=uid,
                        title=f"[Lịch Bảo vệ ĐATN] {council.council_name}",
                        message=f"Bạn được xếp lịch tại {council.council_name} ngày {date_str} ({ca_str}), phòng {room_str}.",
                        notification_type="general",
                        action_url="/student/dashboard?tab=utc_graduation&subtab=grade",
                    )
                )
            try:
                if notifs:
                    Notification.objects.bulk_create(notifs)
                    notified_count = len(notifs)
            except Exception:
                pass

        AuditLog.objects.create(
            user=request.user,
            action_type="evaluation_update",
            description=(
                f"Khoa xử lý {council.council_name}: reopened={reopened}, "
                f"notified_count={notified_count}."
            ),
        )
        return Response(
            {
                "success": True,
                "council_id": council.id,
                "is_finalized": council.is_finalized,
                "reopened": reopened,
                "notified_count": notified_count,
                "message": (
                    f"Đã mở khóa {council.council_name} & gửi {notified_count} thông báo."
                    if reopened
                    else f"Đã gửi {notified_count} thông báo lịch bảo vệ cho {council.council_name}."
                ),
            },
            status=status.HTTP_200_OK,
        )


class DefenseMinutesSignatureAdminView(APIView):
    """Admin xem tiến độ ký Biên bản bảo vệ (X/5 thành viên) của một Hội đồng."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request, council_id):
        council = get_object_or_404(DefenseCouncil, pk=council_id)
        members = list(council.members.select_related("user").all())
        projects = list(council.projects.select_related("student__user").all())
        sigs = list(
            DefenseMinutesSignature.objects.filter(council=council).select_related("member__user", "signed_by")
        )
        sig_by_project = {}
        for s in sigs:
            sig_by_project.setdefault(s.project_id, {})[s.member_id] = s

        total_members = len(members)
        per_project = {}
        fully_signed_count = 0
        for p in projects:
            pmap = sig_by_project.get(p.id, {})
            signed_cnt = len(pmap)
            is_full = total_members > 0 and signed_cnt >= total_members
            if is_full:
                fully_signed_count += 1
            per_project[str(p.id)] = {
                "project_id": p.id,
                "signed_count": signed_cnt,
                "total_members": total_members,
                "is_fully_signed": is_full,
                "members": [
                    {
                        "member_id": m.id,
                        "name": m.user.get_full_name() or m.user.username,
                        "role": m.get_role_display(),
                        "signed": m.id in pmap,
                        "signed_at": pmap[m.id].signed_at if m.id in pmap else None,
                        "note": pmap[m.id].note if m.id in pmap else "",
                    }
                    for m in members
                ],
            }

        return Response(
            {
                "council_id": council.id,
                "council_name": council.council_name,
                "total_members": total_members,
                "total_projects": len(projects),
                "fully_signed_projects": fully_signed_count,
                "total_signatures": len(sigs),
                "by_project": per_project,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# 5. REAL SECURITY CENTER (SESSION REVOCATION & DYNAMIC POLICIES) & TOPICAREAS
# ==============================================================================

class AdminSessionRevokeAPIView(APIView):
    """Thu hồi phiên đăng nhập JWT từ xa (hiệu lực tức thì qua DB + Cache)."""
    permission_classes = [IsAuthenticated, IsSuperAdminOnly]

    def post(self, request, pk):
        session_obj = get_object_or_404(UserSessionLog.objects.select_related("user"), pk=pk)
        reason = str(request.data.get("reason") or "Thu hồi từ Trung tâm Bảo mật Admin").strip()
        revoke_all = str(request.data.get("revoke_all_for_user", "")).lower() in ("true", "1", "yes")

        from .session_auth import revoke_session_by_jti

        revoked_count = 0
        if revoke_all:
            active_logs = list(UserSessionLog.objects.filter(user=session_obj.user, is_active=True))
            for s in active_logs:
                revoke_session_by_jti(s.token_jti, revoked_by=request.user, reason=reason)
                revoked_count += 1
        else:
            revoke_session_by_jti(session_obj.token_jti, revoked_by=request.user, reason=reason)
            revoked_count = 1

        AuditLog.objects.create(
            user=request.user,
            action_type="SECURITY_ALERT",
            description=(
                f"SuperAdmin {request.user.username} đã thu hồi {revoked_count} phiên của "
                f"'{session_obj.user.username}' (portal={session_obj.portal}). Lý do: {reason}"
            ),
        )
        _invalidate_batch_caches()
        return Response(
            {
                "success": True,
                "revoked_count": revoked_count,
                "session_id": session_obj.id,
                "message": f"Đã thu hồi {revoked_count} phiên đăng nhập của {session_obj.user.username}.",
            },
            status=status.HTTP_200_OK,
        )


class AdminSecurityPolicyAPIView(APIView):
    """Xem & cập nhật chính sách bảo mật động (số lần thử sai, thời gian khóa, timeout)."""
    permission_classes = [IsAuthenticated, IsSuperAdminOnly]

    INT_BOUNDS = {
        "max_login_attempts": (1, 20),
        "lockout_minutes": (1, 1440),
        "session_idle_timeout_minutes": (5, 10080),
    }

    def get(self, request):
        from .session_auth import ensure_default_security_policies

        policies = ensure_default_security_policies()
        return Response(
            [
                {
                    "id": p.id,
                    "policy_key": p.policy_key,
                    "label": p.label,
                    "policy_value": p.policy_value,
                    "description": p.description,
                    "updated_at": p.updated_at,
                }
                for p in policies
            ],
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        return self._save_policies(request)

    def patch(self, request):
        return self._save_policies(request)

    def _save_policies(self, request):
        from .session_auth import ensure_default_security_policies

        ensure_default_security_policies()
        payload = request.data.get("policies", request.data)
        items = payload if isinstance(payload, list) else (
            [{"policy_key": k, "policy_value": v} for k, v in payload.items()]
            if isinstance(payload, dict)
            else []
        )
        if not items:
            return Response({"detail": "Vui lòng gửi danh sách policies hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

        updated = []
        for item in items:
            key = str(item.get("policy_key") or "").strip()
            val = str(item.get("policy_value") if item.get("policy_value") is not None else "").strip()
            if not key or val == "":
                continue
            if key in self.INT_BOUNDS:
                try:
                    num = int(val)
                except ValueError:
                    return Response({"detail": f"Chính sách {key} phải là số nguyên."}, status=status.HTTP_400_BAD_REQUEST)
                lo, hi = self.INT_BOUNDS[key]
                if num < lo or num > hi:
                    return Response(
                        {"detail": f"Giá trị {key} phải trong khoảng {lo}..{hi}."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                val = str(num)

            policy, _ = SecurityPolicy.objects.get_or_create(
                policy_key=key,
                defaults={"label": item.get("label") or key, "policy_value": val},
            )
            policy.policy_value = val
            if item.get("label"):
                policy.label = str(item["label"]).strip()
            if "description" in item:
                policy.description = str(item["description"] or "").strip()
            policy.updated_by = request.user
            policy.save()
            cache.delete(f"sec_policy_{key}")
            updated.append(key)

        AuditLog.objects.create(
            user=request.user,
            action_type="SECURITY_ALERT",
            description=f"Cập nhật chính sách bảo mật động: {', '.join(updated)}.",
        )
        _invalidate_batch_caches()
        return self.get(request)


class TopicAreaManageListCreateAPIView(APIView):
    """Quản lý Chuyên ngành / Hướng nghiên cứu (ProjectTopicArea): xem & tạo mới."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        include_inactive = str(request.query_params.get("include_inactive", "")).lower() in ("true", "1")
        qs = ProjectTopicArea.objects.all().order_by("code", "id")
        if not include_inactive:
            qs = qs.filter(is_active=True)
        return Response(ProjectTopicAreaSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        data = dict(request.data)
        data["code"] = str(data.get("code") or "").strip().upper().replace(" ", "_")
        data["name"] = str(data.get("name") or "").strip()
        if not data["code"] or not data["name"]:
            return Response({"detail": "Mã (code) và Tên chuyên ngành là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)
        if ProjectTopicArea.objects.filter(code__iexact=data["code"]).exists():
            return Response({"detail": f"Mã chuyên ngành '{data['code']}' đã tồn tại."}, status=status.HTTP_409_CONFLICT)

        serializer = ProjectTopicAreaSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        area = serializer.save()
        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Tạo chuyên ngành hướng nghiên cứu mới: {area.code} - {area.name}.",
        )
        _invalidate_batch_caches()
        return Response(ProjectTopicAreaSerializer(area).data, status=status.HTTP_201_CREATED)


class TopicAreaManageDetailAPIView(APIView):
    """Cập nhật hoặc xóa một Chuyên ngành / Hướng nghiên cứu."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def patch(self, request, pk):
        area = get_object_or_404(ProjectTopicArea, pk=pk)
        data = dict(request.data)
        if "code" in data and data["code"] is not None:
            data["code"] = str(data["code"]).strip().upper().replace(" ", "_")
        serializer = ProjectTopicAreaSerializer(area, data=data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        updated = serializer.save()
        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Cập nhật chuyên ngành {updated.code} - {updated.name} (active={updated.is_active}).",
        )
        _invalidate_batch_caches()
        return Response(ProjectTopicAreaSerializer(updated).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        area = get_object_or_404(ProjectTopicArea, pk=pk)
        if area.supervisor_links.exists() or area.projects.exists():
            return Response(
                {
                    "detail": (
                        f"Chuyên ngành '{area.name}' đang được giảng viên hoặc đề tài sử dụng. "
                        "Hãy chuyển sang trạng thái Tạm ẩn (is_active=false) thay vì xóa vĩnh viễn."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        label = f"{area.code} - {area.name}"
        area.delete()
        AuditLog.objects.create(
            user=request.user,
            action_type="admin_user_update",
            description=f"Xóa chuyên ngành chưa sử dụng: {label}.",
        )
        _invalidate_batch_caches()
        return Response({"message": f"Đã xóa chuyên ngành {label}."}, status=status.HTTP_200_OK)
