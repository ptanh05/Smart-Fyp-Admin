"""
Service dùng chung: Tính toán tiến trình (6 giai đoạn) của một Đợt đồ án.

Được dùng cho:
- Admin Portal: thanh tiến trình trên đầu mọi trang + API /admin/batches/<id>/progress/
- Student / Supervisor Portal: hiển thị đợt đang ở giai đoạn nào.

Lưu ý: Hai backend (smart-fyp-management & Smart-Fyp-Admin) dùng CHUNG một DB
Neon, nên file này được nhân bản giống hệt ở cả hai bên để logic luôn nhất quán.
"""

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
        "key": "progress",
        "code": "PHASE_5_IN_PROGRESS",
        "label": "GĐ 4: Thực Hiện Đồ Án & Tiến Độ",
        "short_label": "Thực hiện đồ án",
        "icon": "📋",
        "description": "GVHD giao Task/Deadline, SV nộp kết quả, GVHD đánh giá & xác nhận đủ điều kiện bảo vệ",
        "role_hint": "GVHD ↔ Sinh viên",
    },
    {
        "number": 5,
        "key": "defense",
        "code": "PHASE_6_DEFENSE",
        "label": "GĐ 5: Hội Đồng & Bảo Vệ",
        "short_label": "Hội đồng & bảo vệ",
        "icon": "🏛️",
        "description": "Xét điều kiện bảo vệ cuối, thành lập Hội đồng, gán phản biện & xếp lịch bảo vệ",
        "role_hint": "Khoa / Hội đồng",
    },
    {
        "number": 6,
        "key": "closing",
        "code": "COMPLETED",
        "label": "GĐ 6: Chấm Điểm & Đóng Đợt",
        "short_label": "Chấm điểm & đóng đợt",
        "icon": "📝",
        "description": "Chấm điểm rubric, tính điểm tổng kết, xuất biên bản & đóng đợt đồ án",
        "role_hint": "Hội đồng → Khoa",
    },
]

# Map trạng thái DB -> giai đoạn nghiệp vụ (1..6)
DB_STAGE_TO_NUMBER = {
    "PHASE_1_SETUP": 1,
    "PHASE_2_ALLOCATING": 2,
    "PHASE_2_LOCKED": 2,
    "PHASE_3_TOPIC": 3,
    "PHASE_4_ELIGIBILITY": 4,
    "PHASE_5_IN_PROGRESS": 4,
    "PHASE_6_DEFENSE": 5,
    "COMPLETED": 6,
}

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

    defense_ready = GraduationProject.objects.filter(
        batch_id=batch_id, is_eligible_for_defense=True
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

    # GĐ4 - Thực hiện & tiến độ
    g4_base = completed_tasks + reviewed_weekly
    g4_total = (total_tasks + total_weekly) or 1
    g4_percent = _pct(g4_base, g4_total)
    stages.append(
        {
            "number": 4,
            "key": "progress",
            "code": "PHASE_5_IN_PROGRESS",
            "label": "GĐ 4: Thực Hiện Đồ Án & Tiến Độ",
            "short_label": "Thực hiện đồ án",
            "icon": "📋",
            "description": "GVHD giao Task/Deadline, SV nộp kết quả, GVHD đánh giá & xác nhận đủ điều kiện bảo vệ",
            "role_hint": "GVHD ↔ Sinh viên",
            "percent": g4_percent,
            "stats": {
                "Task hoàn thành": f"{completed_tasks}/{total_tasks}",
                "Báo cáo tuần đã duyệt": f"{reviewed_weekly}/{total_weekly}",
                "Đủ điều kiện bảo vệ": defense_ready,
            },
            "action_hint": (
                "GVHD giao task & đánh giá báo cáo tuần"
                if g4_percent < 100
                else "Đã hoàn tất tiến độ, chuyển sang xét điều kiện bảo vệ"
            ),
        }
    )

    # GĐ5 - Hội đồng & bảo vệ
    g5_percent = _pct(scheduled_slots, total_projects or 1)
    stages.append(
        {
            "number": 5,
            "key": "defense",
            "code": "PHASE_6_DEFENSE",
            "label": "GĐ 5: Hội Đồng & Bảo Vệ",
            "short_label": "Hội đồng & bảo vệ",
            "icon": "🏛️",
            "description": "Xét điều kiện bảo vệ cuối, thành lập Hội đồng, gán phản biện & xếp lịch bảo vệ",
            "role_hint": "Khoa / Hội đồng",
            "percent": g5_percent,
            "stats": {
                "Hội đồng": total_councils,
                "Đã xếp lịch bảo vệ": scheduled_slots,
                "Đủ điều kiện bảo vệ": defense_ready,
            },
            "action_hint": (
                "Sinh Hội đồng & xếp lịch bảo vệ"
                if total_councils == 0
                else "Theo dõi & chấm điểm tại buổi bảo vệ"
            ),
        }
    )

    # GĐ6 - Chấm điểm & đóng đợt
    g6_percent = _pct(finalized_grades, total_projects or 1)
    stages.append(
        {
            "number": 6,
            "key": "closing",
            "code": "COMPLETED",
            "label": "GĐ 6: Chấm Điểm & Đóng Đợt",
            "short_label": "Chấm điểm & đóng đợt",
            "icon": "📝",
            "description": "Chấm điểm rubric, tính điểm tổng kết, xuất biên bản & đóng đợt đồ án",
            "role_hint": "Hội đồng → Khoa",
            "percent": 100.0 if batch.current_stage == "COMPLETED" else g6_percent,
            "stats": {
                "Đã chốt điểm": finalized_grades,
                "Tổng đề tài": total_projects,
            },
            "action_hint": (
                "Đợt đã đóng & lưu trữ"
                if batch.current_stage == "COMPLETED"
                else "Chấm điểm & bấm 'Đóng đợt (CLOSED)'"
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

    return {
        "batch": {
            "id": batch.id,
            "batch_code": batch.batch_code,
            "batch_name": batch.batch_name,
            "program_type": batch.program_type,
            "current_stage": batch.current_stage,
            "is_active": batch.is_active,
            "is_closed": batch.is_closed,
            "start_date": batch.start_date,
            "end_date": batch.end_date,
        },
        "is_open": is_open,
        "current_stage_number": current_number,
        "current_stage": current_stage_def,
        "overall_percent": overall,
        "stages": stages,
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
