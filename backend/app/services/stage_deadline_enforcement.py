"""
Dịch vụ kiểm tra và loại bỏ sinh viên chưa hoàn thành khi giai đoạn (GĐ2–GĐ5)
của đợt đồ án đã hết hạn mốc thời gian (`BatchMilestone.end_date < now`).

Quy tắc:
- Chỉ xét các đợt đang mở (`is_closed=False` và `current_stage != 'COMPLETED'`).
- Chỉ xét các giai đoạn từ GĐ2 đến GĐ5 (`EXPULSION_ELIGIBLE_STAGES = (2, 3, 4, 5)`);
  bỏ qua GĐ1 (Admin khởi tạo/nhập dữ liệu) và GĐ6 (Hội đồng/Giáo vụ chốt điểm).
- Một giai đoạn K chỉ coi là hết hạn khi đợt đã đạt tới ít nhất GĐ K
  (`K <= effective_max`) và mốc kết thúc muộn nhất còn hiệu lực của GĐ K
  đã qua (`max_end_date < now`).
- Luôn bảo toàn sinh viên đã Bảo lưu (`DEFERRED`), Đã có kết quả cuối (`PASSED`/`FAILED`),
  hoặc đã bị loại trước đó (`DISQUALIFIED`).
- Sinh viên quá hạn chưa hoàn thành sẽ bị gỡ khỏi đợt (`student.academic_batch = None`),
  đồng thời đánh dấu `DISQUALIFIED` trên hồ sơ `GraduationProject` (nếu đã có),
  tạo `Notification` và ghi `AuditLog`.
"""
import logging

from django.core.cache import cache
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from app.services.batch_progress import DB_STAGE_TO_NUMBER
from app.services.workflow_stages import achieved_stage

logger = logging.getLogger(__name__)

EXPULSION_ELIGIBLE_STAGES = (2, 3, 4, 5)
EXEMPT_PROJECT_STATUSES = frozenset({"DEFERRED", "DISQUALIFIED", "PASSED", "FAILED"})


def _get_approved_draft_project_ids(batch):
    from app.feature_models import SubmissionVersion

    if SubmissionVersion._meta.db_table not in connection.introspection.table_names():
        return set()
    return set(
        SubmissionVersion.objects.filter(
            project__batch=batch,
            kind="REPORT",
            supervisor_review_status="APPROVED",
        ).values_list("project_id", flat=True)
    )


def find_expired_stage_milestones(batch, now=None, max_stage=None):
    """Trả về danh sách mốc muộn nhất của từng GĐ (2..5) đã hết hạn trên đợt."""
    from app.models import BatchMilestone

    if not batch or getattr(batch, "is_closed", False) or getattr(batch, "current_stage", "") == "COMPLETED":
        return []
    if now is None:
        now = timezone.now()

    current_batch_stage = DB_STAGE_TO_NUMBER.get(getattr(batch, "current_stage", ""), 1)
    effective_max = current_batch_stage if max_stage is None else min(current_batch_stage, int(max_stage))
    if effective_max < 2:
        return []

    qs = BatchMilestone.objects.filter(
        batch=batch,
        is_active=True,
        stage_number__in=EXPULSION_ELIGIBLE_STAGES,
        stage_number__lte=effective_max,
        end_date__isnull=False,
    ).order_by("stage_number", "end_date", "id")

    latest_by_stage = {}
    for ms in qs:
        prev = latest_by_stage.get(ms.stage_number)
        if prev is None or ms.end_date > prev.end_date:
            latest_by_stage[ms.stage_number] = ms

    expired = [
        ms for stage_num, ms in sorted(latest_by_stage.items())
        if ms.end_date and ms.end_date < now
    ]
    return expired


def _is_student_exempt(project):
    if project is None:
        return False
    status = getattr(project, "status", "") or ""
    deferral_status = getattr(project, "deferral_status", "NONE") or "NONE"
    return status in EXEMPT_PROJECT_STATUSES or deferral_status == "APPROVED"


def _evaluate_student_unfinished_at_stage(project, stage_number, approved_draft_project_ids):
    """Kiểm tra một sinh viên đã hoàn thành xong yêu cầu của GĐ `stage_number` hay chưa."""
    if _is_student_exempt(project):
        return False, ""

    achieved = achieved_stage(project)

    if stage_number == 2:
        if project is None or getattr(project, "supervisor_id", None) is None:
            return True, "Quá hạn Giai đoạn 2: Chưa được phân công Giảng viên hướng dẫn."
        return False, ""

    if stage_number == 3:
        if project is None or getattr(project, "supervisor_id", None) is None:
            return True, "Quá hạn Giai đoạn 3: Chưa có đề tài / Giảng viên hướng dẫn."
        if achieved < 4:
            return True, "Quá hạn Giai đoạn 3: Đề cương ĐATN chưa được Khoa phê duyệt."
        return False, ""

    if stage_number == 4:
        if project is None or getattr(project, "supervisor_id", None) is None or achieved < 4:
            return True, "Quá hạn Giai đoạn 4: Chưa hoàn thành đề cương để bước vào xét điều kiện/bản nháp."
        init_elig = getattr(project, "initial_eligibility", "PENDING") or "PENDING"
        is_forced = bool(getattr(project, "is_force_approved", False))
        if init_elig == "INELIGIBLE" and not is_forced:
            return True, "Quá hạn Giai đoạn 4: Không đủ điều kiện làm đồ án và chưa được Khoa đặc cách."
        proj_status = getattr(project, "status", "") or ""
        if proj_status not in {"IN_PROGRESS", "DEFENSE_READY", "DEFENDING", "DEFENDED", "PASSED", "FAILED"}:
            if project.id not in approved_draft_project_ids:
                return True, "Quá hạn Giai đoạn 4: Chưa có bản nháp báo cáo được GVHD duyệt."
        return False, ""

    if stage_number == 5:
        if project is None or getattr(project, "supervisor_id", None) is None:
            return True, "Quá hạn Giai đoạn 5: Chưa có hồ sơ đồ án hợp lệ."
        proj_status = getattr(project, "status", "") or ""
        if (
            achieved < 6
            and not getattr(project, "is_eligible_for_defense", False)
            and not getattr(project, "supervisor_defense_confirmed", False)
            and proj_status not in {"DEFENSE_READY", "DEFENDING", "DEFENDED", "PASSED", "FAILED"}
        ):
            return True, "Quá hạn Giai đoạn 5: Chưa được GVHD xác nhận đủ điều kiện bảo vệ."
        return False, ""

    return False, ""


def _invalidate_enforcement_caches():
    for key in (
        "admin_academic_batches_list",
        "admin_dashboard_user_summary",
        "admin_security_metrics_cache",
    ):
        try:
            cache.delete(key)
        except Exception:
            pass


def enforce_batch_stage_deadlines(batch, actor_user=None, now=None, max_stage=None, dry_run=False):
    """
    Quét và (nếu dry_run=False) loại các sinh viên chưa hoàn thành ở các GĐ2–GĐ5
    đã quá hạn mốc thời gian của đợt `batch`.
    """
    from app.models import AuditLog, GraduationProject, Notification, Student

    if now is None:
        now = timezone.now()

    expired_milestones = find_expired_stage_milestones(batch, now=now, max_stage=max_stage)
    expired_payload = [
        {
            "milestone_id": ms.id,
            "stage_number": ms.stage_number,
            "name": ms.name,
            "end_date": ms.end_date.isoformat() if ms.end_date else None,
        }
        for ms in expired_milestones
    ]

    if not expired_milestones:
        return {
            "batch_id": getattr(batch, "id", None),
            "batch_code": getattr(batch, "batch_code", ""),
            "dry_run": bool(dry_run),
            "expired_stages": [],
            "candidates": [],
            "candidate_count": 0,
            "removed_count": 0,
            "removed_students": [],
        }

    approved_draft_ids = (
        _get_approved_draft_project_ids(batch)
        if any(ms.stage_number == 4 for ms in expired_milestones)
        else set()
    )

    students = list(
        Student.objects.filter(Q(academic_batch=batch) | Q(graduation_project__batch=batch))
        .distinct()
        .select_related("user", "graduation_project", "graduation_project__supervisor__user")
    )

    matched = []
    for st in students:
        proj = getattr(st, "graduation_project", None)
        if proj is not None and proj.batch_id not in (None, batch.id):
            proj = None

        for ms in expired_milestones:
            unfinished, reason = _evaluate_student_unfinished_at_stage(
                proj, ms.stage_number, approved_draft_ids
            )
            if unfinished:
                user_obj = getattr(st, "user", None)
                full_name = (
                    f"{user_obj.last_name or ''} {user_obj.first_name or ''}".strip()
                    or getattr(user_obj, "username", "")
                ) if user_obj else st.registration_no
                matched.append({
                    "student": st,
                    "project": proj,
                    "milestone": ms,
                    "payload": {
                        "student_id": st.id,
                        "registration_no": st.registration_no,
                        "full_name": full_name,
                        "project_id": proj.id if proj else None,
                        "failed_stage": ms.stage_number,
                        "milestone_id": ms.id,
                        "milestone_name": ms.name,
                        "milestone_end_date": ms.end_date.isoformat() if ms.end_date else None,
                        "current_status": proj.status if proj else "UNASSIGNED",
                        "reason": reason,
                    },
                })
                break

    candidates_payload = [item["payload"] for item in matched]

    if dry_run or not matched:
        return {
            "batch_id": batch.id,
            "batch_code": batch.batch_code,
            "dry_run": bool(dry_run),
            "expired_stages": expired_payload,
            "candidates": candidates_payload,
            "candidate_count": len(candidates_payload),
            "removed_count": 0,
            "removed_students": [],
        }

    removed_payload = []
    notifications_to_create = []
    sup_notified = set()

    with transaction.atomic():
        for item in matched:
            st = item["student"]
            proj = item["project"]
            ms = item["milestone"]
            info = item["payload"]
            reason = info["reason"]

            if st.academic_batch_id == batch.id:
                st.academic_batch = None
                st.save(update_fields=["academic_batch"])

            if proj is not None:
                proj.status = "DISQUALIFIED"
                proj.initial_eligibility = "DISQUALIFIED"
                proj.ineligibility_reason = reason
                proj.save(update_fields=["status", "initial_eligibility", "ineligibility_reason"])

                if proj.supervisor_id and proj.supervisor and proj.supervisor.user_id:
                    key = (proj.supervisor.user_id, st.id, ms.stage_number)
                    if key not in sup_notified:
                        sup_notified.add(key)
                        notifications_to_create.append(
                            Notification(
                                user_id=proj.supervisor.user_id,
                                title=f"[SV quá hạn GĐ {ms.stage_number}] {st.registration_no}",
                                message=(
                                    f"Sinh viên {info['full_name']} ({st.registration_no}) đã bị loại khỏi "
                                    f"đợt {batch.batch_code} do quá hạn mốc \"{ms.name}\". {reason}"
                                ),
                                notification_type="general",
                                action_url="/supervisor/dashboard",
                            )
                        )

            if st.user_id:
                notifications_to_create.append(
                    Notification(
                        user_id=st.user_id,
                        title=f"[Loại khỏi đợt {batch.batch_code}] Quá hạn hoàn thành GĐ {ms.stage_number}",
                        message=(
                            f"Mốc \"{ms.name}\" đã hết hạn và hệ thống ghi nhận bạn chưa hoàn thành "
                            f"yêu cầu giai đoạn {ms.stage_number}. {reason}"
                        ),
                        notification_type="general",
                        action_url="/student/dashboard?tab=overview",
                    )
                )

            removed_payload.append(info)

        if notifications_to_create:
            Notification.objects.bulk_create(notifications_to_create)

        AuditLog.objects.create(
            user=actor_user if getattr(actor_user, "pk", None) else None,
            action_type="evaluation_update",
            description=(
                f"Hệ thống tự động loại {len(removed_payload)} sinh viên khỏi đợt {batch.batch_code} "
                f"do quá hạn mốc giai đoạn ({', '.join(f'GĐ{m.stage_number}' for m in expired_milestones)})."
            ),
        )

    _invalidate_enforcement_caches()

    return {
        "batch_id": batch.id,
        "batch_code": batch.batch_code,
        "dry_run": False,
        "expired_stages": expired_payload,
        "candidates": removed_payload,
        "candidate_count": len(removed_payload),
        "removed_count": len(removed_payload),
        "removed_students": removed_payload,
    }


def enforce_all_active_batches_stage_deadlines(actor_user=None, now=None, dry_run=False):
    """Chạy kiểm tra quá hạn giai đoạn trên toàn bộ các đợt đang mở."""
    from app.models import AcademicBatch

    if now is None:
        now = timezone.now()

    batches = list(
        AcademicBatch.objects.filter(is_active=True, is_closed=False)
        .exclude(current_stage="COMPLETED")
        .order_by("id")
    )
    results = []
    total_removed = 0
    for batch in batches:
        res = enforce_batch_stage_deadlines(batch, actor_user=actor_user, now=now, dry_run=dry_run)
        if res["candidate_count"] > 0:
            results.append(res)
            total_removed += res["removed_count"]
    return {
        "scanned_batches": len(batches),
        "total_removed": total_removed,
        "results": results,
    }
