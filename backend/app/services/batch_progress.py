"""
Service dùng chung: Tính toán tiến trình (6 giai đoạn) của một Đợt đồ án.

Được dùng cho:
- Admin Portal: thanh tiến trình trên đầu mọi trang + API /admin/batches/<id>/progress/
- Student / Supervisor Portal: hiển thị đợt đang ở giai đoạn nào.

Lưu ý: Hai backend (smart-fyp-management & Smart-Fyp-Admin) dùng CHUNG một DB
Neon, nên file này được nhân bản giống hệt ở cả hai bên để logic luôn nhất quán.
"""

from django.db import connection
from django.db.models import Count, Q

# ---------------------------------------------------------------------------
# Định nghĩa 6 giai đoạn nghiệp vụ của Đợt đồ án
# ---------------------------------------------------------------------------
BATCH_STAGE_DEFINITIONS = [
    {
        "number": 1,
        "key": "setup",
        "code": "PHASE_1_SETUP",
        "label": "GĐ 1: Khởi Tạo Đợt & Thiết Lập",
        "short_label": "Khởi tạo đợt",
        "icon": "📅",
        "description": "Tạo đợt, import sinh viên, thêm giảng viên & cấu hình quota, mở đợt cho SV đăng ký",
        "role_hint": "Khoa / Admin",
    },
    {
        "number": 2,
        "key": "allocating",
        "code": "PHASE_2_ALLOCATING",
        "label": "GĐ 2: Nguyện Vọng & Phân Công GVHD",
        "short_label": "Phân công GVHD",
        "icon": "🤝",
        "description": "SV nộp nguyện vọng NV1-NV3, Khoa chạy thuật toán tối ưu & chốt phân công",
        "role_hint": "Sinh viên → Khoa",
    },
    {
        "number": 3,
        "key": "topic",
        "code": "PHASE_3_TOPIC",
        "label": "GĐ 3: Xây Dựng & Phê Duyệt Đề Cương",
        "short_label": "Duyệt đề cương",
        "icon": "📄",
        "description": "SV nộp đề cương, GVHD duyệt, Khoa phê duyệt & sinh mã đề tài chính thức",
        "role_hint": "Sinh viên → GVHD → Khoa",
    },
    {
        "number": 4,
        "key": "eligibility",
        "code": "PHASE_4_ELIGIBILITY",
        "label": "GĐ 4: Xét Điều Kiện & Báo Cáo Tiến Độ Tuần",
        "short_label": "Nộp bản nháp đồ án",
        "icon": "📋",
        "description": "Khoa xét điều kiện làm đồ án / đặc cách, SV nộp báo cáo tiến độ tuần, GVHD nhận xét",
        "role_hint": "Khoa / Sinh viên ↔ GVHD",
    },
    {
        "number": 5,
        "key": "progress",
        "code": "PHASE_5_IN_PROGRESS",
        "label": "GĐ 5: Thực Hiện Đồ Án (Task & Nhật Ký)",
        "short_label": "Task, nhật ký & báo cáo tuần",
        "icon": "🧭",
        "description": "GVHD giao Task/Deadline, ghi nhật ký hướng dẫn, SV nộp kết quả, GVHD xác nhận hoàn thành",
        "role_hint": "GVHD ↔ Sinh viên",
    },
    {
        "number": 6,
        "key": "defense",
        "code": "PHASE_6_DEFENSE",
        "label": "GĐ 6: Đánh Giá, Bảo Vệ & Đóng Đợt",
        "short_label": "Đánh giá & bảo vệ",
        "icon": "🏛️",
        "description": "GVHD đánh giá, phản biện, Hội đồng bảo vệ & chấm điểm, Khoa chốt điểm và đóng đợt",
        "role_hint": "GVHD / Phản biện / Hội đồng → Khoa",
    },
]

# Map trạng thái DB -> giai đoạn nghiệp vụ (1..6).
# PHẢI khớp workflow_stages.BATCH_STAGE_TO_NUMBER (contract test kiểm tra) để
# thanh tiến trình đợt, sidebar và guard backend dùng chung một thang số.
DB_STAGE_TO_NUMBER = {
    "PHASE_1_SETUP": 1,
    "PHASE_2_ALLOCATING": 2,
    "PHASE_2_LOCKED": 2,
    "PHASE_3_TOPIC": 3,
    "PHASE_4_ELIGIBILITY": 4,
    "PHASE_5_IN_PROGRESS": 5,
    "PHASE_6_DEFENSE": 6,
    "COMPLETED": 6,
}

_DEFINITIONS_BY_NUMBER = {d["number"]: d for d in BATCH_STAGE_DEFINITIONS}

TOTAL_STAGES = len(BATCH_STAGE_DEFINITIONS)


def _pct(done, total):
    if not total:
        return 0
    return round(min(100, (done / total) * 100), 1)


def compute_batch_progress(batch):
    """
    Trả về cấu trúc tiến trình chi tiết của một Đợt đồ án.

    Output:
    {
        "batch": {...},
        "current_stage_number": 1..6,
        "current_stage": {...},
        "overall_percent": 0..100,
        "is_open": bool,
        "stages": [ {number, key, label, short_label, icon, description, role_hint,
                     status: "done"|"active"|"pending"|"locked",
                     percent: 0..100,
                     stats: {label: value},   # các chỉ số phụ
                     action_hint: str}, ... ],
        "next_actions": [str, ...]
    }
    """
    from app.models import (
        AcademicBatch,
        CourseClass,
        DefenseCouncil,
        FinalGradeSummary,
        GraduationProject,
        Student,
        StudentPreference,
        SupervisorQuota,
        SupervisionTask,
        WeeklyProgressReport,
    )
    from app.feature_models import SubmissionVersion

    batch_id = batch.id
    current_number = DB_STAGE_TO_NUMBER.get(batch.current_stage, 1)
    is_open = bool(batch.is_active and not batch.is_closed and batch.current_stage != "COMPLETED")

    # ------------------------------------------------------------------
    # Thu thập số liệu
    # ------------------------------------------------------------------
    total_students = Student.objects.filter(academic_batch_id=batch_id).count()
    total_classes = CourseClass.objects.filter(batch_id=batch_id).count()
    total_quotas = SupervisorQuota.objects.filter(batch_id=batch_id).count()
    total_supervisor_slots = sum(
        (q.max_total_quota or 0) for q in SupervisorQuota.objects.filter(batch_id=batch_id).only("max_total_quota")
    )

    total_preferences = StudentPreference.objects.filter(batch_id=batch_id).count()
    total_projects = GraduationProject.objects.filter(batch_id=batch_id).count()
    assigned_projects = GraduationProject.objects.filter(
        batch_id=batch_id, supervisor__isnull=False
    ).count()

    total_outlines = GraduationProject.objects.filter(batch_id=batch_id).count()
    approved_outlines = GraduationProject.objects.filter(
        batch_id=batch_id, topic_review_status="APPROVED"
    ).count()

    total_tasks = SupervisionTask.objects.filter(project__batch_id=batch_id).count()
    completed_tasks = SupervisionTask.objects.filter(
        project__batch_id=batch_id, is_completed=True
    ).count()

    total_weekly = WeeklyProgressReport.objects.filter(project__batch_id=batch_id).count()
    reviewed_weekly = WeeklyProgressReport.objects.filter(
        project__batch_id=batch_id
    ).exclude(supervisor_rating="PENDING").count()
    if SubmissionVersion._meta.db_table in connection.introspection.table_names():
        projects_with_draft = SubmissionVersion.objects.filter(
            project__batch_id=batch_id, kind="REPORT", supervisor_review_status="APPROVED"
        ).values("project_id").distinct().count()
    else:
        # Một số môi trường test/triển khai cũ chưa có bảng feature extension.
        projects_with_draft = 0

    defense_ready = GraduationProject.objects.filter(
        batch_id=batch_id, is_eligible_for_defense=True
    ).count()

    eligible_projects = GraduationProject.objects.filter(
        batch_id=batch_id, initial_eligibility__in=["ELIGIBLE", "FORCE_APPROVED"]
    ).count()

    total_councils = DefenseCouncil.objects.filter(batch_id=batch_id).count()
    scheduled_slots = DefenseCouncil.objects.filter(
        batch_id=batch_id, schedule_slots__isnull=False
    ).distinct().count()

    finalized_grades = FinalGradeSummary.objects.filter(
        project__batch_id=batch_id, is_finalized=True
    ).count()

    # ------------------------------------------------------------------
    # Tính trạng thái & % từng giai đoạn
    # ------------------------------------------------------------------
    stages = []

    # GĐ1 - Khởi tạo đợt
    if total_students > 0 and total_quotas > 0 and is_open:
        g1_percent = 100.0
    elif total_students > 0 and total_quotas > 0:
        g1_percent = 80.0
    elif total_students > 0:
        g1_percent = 40.0
    else:
        g1_percent = 0.0
    stages.append(
        {
            "number": 1,
            "key": "setup",
            "code": "PHASE_1_SETUP",
            "label": "GĐ 1: Khởi Tạo Đợt & Thiết Lập",
            "short_label": "Khởi tạo đợt",
            "icon": "📅",
            "description": "Tạo đợt, import sinh viên, thêm giảng viên & cấu hình quota, mở đợt cho SV đăng ký",
            "role_hint": "Khoa / Admin",
            "percent": g1_percent,
            "stats": {
                "Sinh viên": total_students,
                "Lớp học phần": total_classes,
                "GV trong đợt": total_quotas,
                "Tổng quota": total_supervisor_slots,
            },
            "action_hint": (
                "Đợt đang mở cho sinh viên đăng ký"
                if is_open
                else "Cần import sinh viên, thêm GV & bấm 'Mở đợt (OPEN)'"
            ),
        }
    )

    # GĐ2 - Nguyện vọng & phân công
    g2_percent = _pct(assigned_projects, total_projects or 1)
    stages.append(
        {
            "number": 2,
            "key": "allocating",
            "code": "PHASE_2_ALLOCATING",
            "label": "GĐ 2: Nguyện Vọng & Phân Công GVHD",
            "short_label": "Phân công GVHD",
            "icon": "🤝",
            "description": "SV nộp nguyện vọng NV1-NV3, Khoa chạy thuật toán tối ưu & chốt phân công",
            "role_hint": "Sinh viên → Khoa",
            "percent": g2_percent,
            "stats": {
                "Đã nộp nguyện vọng": total_preferences,
                "Đề tài đã tạo": total_projects,
                "Đã phân GVHD": assigned_projects,
            },
            "action_hint": (
                "Chạy thuật toán phân công & bấm 'Chốt kết quả phân công'"
                if total_preferences > 0 and assigned_projects < total_students
                else "Sinh viên đăng ký nguyện vọng tại GĐ 2"
            ),
        }
    )

    # GĐ3 - Đề cương
    g3_percent = _pct(approved_outlines, total_outlines or 1)
    stages.append(
        {
            "number": 3,
            "key": "topic",
            "code": "PHASE_3_TOPIC",
            "label": "GĐ 3: Xây Dựng & Phê Duyệt Đề Cương",
            "short_label": "Duyệt đề cương",
            "icon": "📄",
            "description": "SV nộp đề cương, GVHD duyệt, Khoa phê duyệt & sinh mã đề tài chính thức",
            "role_hint": "Sinh viên → GVHD → Khoa",
            "percent": g3_percent,
            "stats": {
                "Đề cương đã duyệt": approved_outlines,
                "Tổng đề tài": total_outlines,
            },
            "action_hint": (
                "Phê duyệt đề cương còn lại"
                if approved_outlines < total_outlines and total_outlines > 0
                else "SV nộp đề cương tại GĐ 3"
            ),
        }
    )

    # GĐ4 - Sinh viên nộp phiên bản bản nháp báo cáo/quyển đồ án
    g4_total = total_projects or 1
    g4_percent = _pct(projects_with_draft, g4_total)
    stages.append(
        {
            **_DEFINITIONS_BY_NUMBER[4],
            "percent": g4_percent,
            "stats": {
                "Bản nháp GVHD đã duyệt": f"{projects_with_draft}/{total_projects}",
            },
            "action_hint": (
                "Sinh viên nộp bản nháp và GVHD phê duyệt"
                if g4_percent < 100
                else "GVHD đã duyệt đủ bản nháp, có thể chuyển đợt sang giai đoạn thực hiện"
            ),
        }
    )

    # GĐ5 - Thực hiện đồ án (task board, nhật ký và báo cáo tuần)
    g5_total = (total_tasks + total_projects + total_weekly) or 1
    g5_percent = _pct(completed_tasks + defense_ready + reviewed_weekly, g5_total)
    stages.append(
        {
            **_DEFINITIONS_BY_NUMBER[5],
            "percent": g5_percent,
            "stats": {
                "Task hoàn thành": f"{completed_tasks}/{total_tasks}",
                "Báo cáo tuần đã duyệt": f"{reviewed_weekly}/{total_weekly}",
                "GVHD xác nhận hoàn thành": f"{defense_ready}/{total_projects}",
            },
            "action_hint": (
                "GVHD giao task, nhận xét báo cáo tuần, ghi nhật ký & xác nhận hoàn thành GĐ5"
                if g5_percent < 100
                else "Đã hoàn tất thực hiện, chuyển sang đánh giá & bảo vệ"
            ),
        }
    )

    # GĐ6 - Đánh giá, bảo vệ & đóng đợt
    g6_total = (total_projects * 2) or 1
    g6_percent = _pct(scheduled_slots + finalized_grades, g6_total)
    stages.append(
        {
            **_DEFINITIONS_BY_NUMBER[6],
            "percent": 100.0 if batch.current_stage == "COMPLETED" else g6_percent,
            "stats": {
                "Hội đồng": total_councils,
                "Đã xếp lịch bảo vệ": scheduled_slots,
                "Đủ điều kiện bảo vệ": defense_ready,
                "Đã chốt điểm": f"{finalized_grades}/{total_projects}",
            },
            "action_hint": (
                "Đợt đã đóng & lưu trữ"
                if batch.current_stage == "COMPLETED"
                else (
                    "Sinh Hội đồng & xếp lịch bảo vệ"
                    if total_councils == 0
                    else "Chấm điểm, chốt điểm & bấm 'Đóng đợt (CLOSED)'"
                )
            ),
        }
    )

    # Gán trạng thái done / active / pending
    for st in stages:
        n = st["number"]
        if n < current_number:
            st["status"] = "done"
            st["percent"] = 100.0
        elif n == current_number:
            st["status"] = "active"
            if batch.current_stage == "COMPLETED":
                st["status"] = "done"
                st["percent"] = 100.0
        else:
            st["status"] = "pending"
            st["percent"] = 0.0

    # % tổng thể = trung bình các giai đoạn đã "đóng" + phần % của giai đoạn hiện tại
    weights = [st["percent"] for st in stages]
    overall = round(sum(weights) / len(weights), 1) if weights else 0.0

    next_actions = []
    if not is_open and current_number == 1:
        next_actions.append("🔓 Mở đợt (OPEN) để sinh viên bắt đầu đăng ký nguyện vọng")
    for st in stages:
        if st["status"] == "active" and st["action_hint"]:
            next_actions.append(f"{st['icon']} {st['short_label']}: {st['action_hint']}")

    current_stage_def = next(
        (s for s in BATCH_STAGE_DEFINITIONS if s["number"] == current_number),
        BATCH_STAGE_DEFINITIONS[0],
    )

    milestones_data = []
    current_milestone = None
    days_left = None
    try:
        from django.utils import timezone
        from app.models import BatchMilestone

        now = timezone.now()
        today = timezone.localdate()
        ms_qs = list(
            BatchMilestone.objects.filter(batch=batch, is_active=True).order_by("order_index", "start_date", "id")
        )
        for m in ms_qs:
            if m.start_date and m.start_date > now:
                m_status = "UPCOMING"
            elif m.end_date and m.end_date < now:
                m_status = "EXPIRED"
            elif m.start_date or m.end_date:
                m_status = "ACTIVE"
            else:
                m_status = "UNSCHEDULED"

            m_days = (m.end_date.date() - today).days if m.end_date else None
            item = {
                "id": m.id,
                "name": m.name,
                "stage_number": m.stage_number,
                "start_date": m.start_date.isoformat() if m.start_date else None,
                "end_date": m.end_date.isoformat() if m.end_date else None,
                "description": m.description or "",
                "order_index": m.order_index,
                "status": m_status,
                "days_left": m_days,
            }
            milestones_data.append(item)

        current_milestone = (
            next((item for item in milestones_data if item["stage_number"] == current_number), None)
            or next((item for item in milestones_data if item["status"] == "ACTIVE"), None)
            or (milestones_data[0] if milestones_data else None)
        )
        if current_milestone is not None:
            days_left = current_milestone.get("days_left")
    except Exception:
        milestones_data = []

    return {
        "batch": {
            "id": batch.id,
            "batch_code": batch.batch_code,
            "batch_name": batch.batch_name,
            "program_type": batch.program_type,
            "current_stage": batch.current_stage,
            "is_active": batch.is_active,
            "is_closed": batch.is_closed,
            "supplementary_open": bool(getattr(batch, "supplementary_open", False)),
            "start_date": batch.start_date,
            "end_date": batch.end_date,
        },
        "is_open": is_open,
        "supplementary_open": bool(getattr(batch, "supplementary_open", False)),
        "current_stage_number": current_number,
        "current_stage_key": current_stage_def["key"],
        "current_stage_label": current_stage_def["label"],
        "batch_status": batch.current_stage,
        "current_stage": current_stage_def,
        "overall_percent": overall,
        "stages": stages,
        "milestones": milestones_data,
        "current_milestone": current_milestone,
        "days_left": days_left,
        "next_actions": next_actions,
        "summary": {
            "total_students": total_students,
            "total_projects": total_projects,
            "assigned_projects": assigned_projects,
            "total_quotas": total_quotas,
            "total_councils": total_councils,
            "finalized_grades": finalized_grades,
        },
    }
