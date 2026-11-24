"""
NGUỒN SỰ THẬT DUY NHẤT cho lộ trình 6 giai đoạn đồ án tốt nghiệp UTC.

File này được nhân bản GIỐNG HỆT ở hai backend dùng chung database:
- smart-fyp-management/backend/app/workflow_stages.py
- Smart-Fyp-Admin/backend/app/services/workflow_stages.py

Không sửa riêng một bên. Mọi thay đổi phải:
1. Sửa đồng thời cả hai file (nội dung y hệt) và tăng CONTRACT_VERSION.
2. Cập nhật app/tests/fixtures/stage_contract_cases.json ở CẢ HAI repo.
   Test contract (test_workflow_stage_contract.py) ở mỗi repo chạy toàn bộ
   các case trong fixture và so sánh nội dung file với repo anh em nếu có.

Module thuần Python: chỉ đọc thuộc tính của đối tượng project/batch, không
import model, không ghi DB, không phát sinh truy vấn (trừ khi thuộc tính
`batch` của project chưa được select_related).

QUY TẮC (tóm tắt)
-----------------
Số giai đoạn của đợt (B) lấy từ AcademicBatch.current_stage:
    PHASE_1_SETUP=1, PHASE_2_*=2, PHASE_3_TOPIC=3, PHASE_4_ELIGIBILITY=4,
    PHASE_5_IN_PROGRESS=5, PHASE_6_DEFENSE=6, COMPLETED=6 (đợt đã đóng).

Tiến độ thực tế của đồ án (P) lấy từ dữ liệu đồ án:
    - Chưa có đồ án (chưa phân công)          -> 1 (2 nếu đợt đã mở GĐ2)
    - Đã phân công GVHD                        -> 2
    - Đang xây dựng đề tài / đề cương          -> 3
    - Khoa đã phê duyệt đề cương               -> 4 (status OUTLINE_APPROVED)
    - Khoa xác nhận đủ ĐK làm đồ án (trong GĐ4)-> 4 (status IN_PROGRESS; importer
                                                   xét ĐK chuyển đợt sang PHASE_4)
    - GĐ5 (task board) chỉ mở khi Khoa chuyển đợt sang PHASE_5_IN_PROGRESS
      (sàn của đợt), không tự mở theo dữ liệu đồ án.
    - GVHD xác nhận hoàn thành thực hiện       -> 6 (DEFENSE_READY, DEFENDING,
                                                   DEFENDED, PASSED, FAILED)

Giai đoạn hiện tại = min(max(P, B), trần)
    - Khoa chuyển đợt (B) là quyết định mở giai đoạn cho cả đợt và đóng các
      giai đoạn trước đó (chỉ còn xem).
    - Đồ án có thể đi trước đợt nhờ dữ liệu thật (VD: Khoa duyệt đề cương
      sớm -> mở GĐ4 cho riêng đồ án đó).
    - "Trần" chặn việc đợt kéo đồ án đi quá điều kiện bắt buộc:
        chưa phân công GVHD -> tối đa GĐ2;
        không đủ ĐK làm đồ án (chờ đặc cách) -> tối đa GĐ4.
    - Đồ án bị bảo lưu / bị loại / đề cương bị bác: KHÔNG áp dụng sàn của
      đợt, dừng ở giai đoạn đã đạt và mọi giai đoạn đều chỉ xem.

Trạng thái từng giai đoạn: completed | active | locked
    completed: giai đoạn trước giai đoạn hiện tại (xem được, không sửa)
    active:    giai đoạn hiện tại; `editable`=False khi đợt đã đóng, đồ án bị
               dừng (is_blocked) hoặc đã có kết quả cuối cùng (is_finished)
    locked:    giai đoạn tương lai, không truy cập được (kèm `reason`)
"""

CONTRACT_VERSION = "2026-11-24.1"

TOTAL_STAGES = 6

PROJECT_STAGES = (
    {"number": 1, "key": "project", "label": "Đề tài & phân công GVHD"},
    {"number": 2, "key": "survey", "label": "Khảo sát nguyện vọng"},
    {"number": 3, "key": "outline", "label": "Đề cương ĐATN & ký duyệt"},
    {"number": 4, "key": "weekly", "label": "Nộp bản nháp đồ án"},
    {"number": 5, "key": "supervision", "label": "Thực hiện đồ án & báo cáo tiến độ"},
    {"number": 6, "key": "grade", "label": "Đánh giá & bảo vệ"},
)

STAGE_KEYS = {s["number"]: s["key"] for s in PROJECT_STAGES}
STAGE_LABELS = {s["number"]: s["label"] for s in PROJECT_STAGES}

# Mã giai đoạn của đợt (AcademicBatch.current_stage) -> số giai đoạn 1..6.
BATCH_STAGE_TO_NUMBER = {
    "PHASE_1_SETUP": 1,
    "PHASE_2_ALLOCATING": 2,
    "PHASE_2_LOCKED": 2,
    "PHASE_3_TOPIC": 3,
    "PHASE_4_ELIGIBILITY": 4,
    "PHASE_5_IN_PROGRESS": 5,
    "PHASE_6_DEFENSE": 6,
    "COMPLETED": 6,
}

# Nhóm trạng thái GraduationProject.status theo giai đoạn đạt được.
# Các trạng thái TOPIC_* / PENDING_REVIEW / DEFENDING / DEFENDED không có trong
# STATUS_CHOICES nhưng vẫn được các API cũ ghi vào DB nên phải được ánh xạ.
OUTLINE_STAGE_STATUSES = frozenset({
    "TOPIC_DRAFT",
    "TOPIC_CONFIRMED",
    "PENDING_REVIEW",
    "TOPIC_APPROVED",
    "TOPIC_REVISION",
    "OUTLINE_PENDING",
    "OUTLINE_REVISION",
})
WEEKLY_STAGE_STATUSES = frozenset({"OUTLINE_APPROVED"})
EXECUTION_STAGE_STATUSES = frozenset({"IN_PROGRESS"})
DEFENSE_STAGE_STATUSES = frozenset({"DEFENSE_READY", "DEFENDING", "DEFENDED"})
FINISHED_STATUSES = frozenset({"PASSED", "FAILED"})
DEFERRED_STATUSES = frozenset({"DEFERRED"})
DISQUALIFIED_STATUSES = frozenset({"DISQUALIFIED"})

# Trạng thái chứng minh Khoa đã phê duyệt đề cương (đồ án đã qua GĐ3).
OUTLINE_APPROVED_STATUSES = (
    WEEKLY_STAGE_STATUSES | EXECUTION_STAGE_STATUSES | DEFENSE_STAGE_STATUSES | FINISHED_STATUSES
)

ELIGIBLE_VALUES = frozenset({"ELIGIBLE", "FORCE_APPROVED"})

STATUS_COMPLETED = "completed"
STATUS_ACTIVE = "active"
STATUS_LOCKED = "locked"


def _get(obj, name, default=None):
    if obj is None:
        return default
    value = getattr(obj, name, default)
    return default if value is None else value


def batch_stage_number(batch):
    """Số giai đoạn 1..6 của đợt; không có đợt -> 1."""
    return BATCH_STAGE_TO_NUMBER.get(_get(batch, "current_stage", ""), 1)


def batch_is_closed(batch):
    """Đợt đã khóa sổ: mọi thao tác ghi đều bị chặn, chỉ còn xem."""
    if batch is None:
        return False
    return bool(_get(batch, "is_closed", False)) or _get(batch, "current_stage", "") == "COMPLETED"


def timeline_step_for_stage(stage_number):
    """Ánh xạ 6 giai đoạn sang dòng thời gian rút gọn 5 bước (UTCFypTimeline)."""
    mapping = {1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5}
    return mapping.get(int(stage_number or 1), 1)


def _project_batch(project, batch):
    if batch is not None:
        return batch
    return getattr(project, "batch", None) if project is not None else None


def _outline_rejected(project):
    """GVHD/Khoa bác đề cương (FAILED + REJECTED) chứ không phải trượt bảo vệ."""
    return (
        _get(project, "status", "") == "FAILED"
        and _get(project, "topic_review_status", "") == "REJECTED"
        and _get(project, "supervisor_score") is None
        and _get(project, "reviewer_score") is None
    )


def _has_defense_evidence(project):
    return bool(
        _get(project, "is_eligible_for_defense", False)
        or _get(project, "supervisor_defense_confirmed", False)
        or _get(project, "supervisor_score") is not None
        or _get(project, "reviewer_score") is not None
    )


def achieved_stage(project):
    """Giai đoạn tối đa mà DỮ LIỆU đồ án chứng minh đã mở (không xét đợt)."""
    if project is None:
        return 1
    status = _get(project, "status", "")
    review = _get(project, "topic_review_status", "")

    if status in DEFENSE_STAGE_STATUSES:
        return 6
    if status in FINISHED_STATUSES:
        return 3 if _outline_rejected(project) else 6
    if status in EXECUTION_STAGE_STATUSES | WEEKLY_STAGE_STATUSES:
        return 6 if _has_defense_evidence(project) else 4

    # Trạng thái bị dừng (DEFERRED/DISQUALIFIED) ghi đè status; dùng các trường
    # bằng chứng còn lại để biết đồ án đã đi tới đâu trước khi bị dừng.
    if status in DEFERRED_STATUSES | DISQUALIFIED_STATUSES:
        if _has_defense_evidence(project):
            return 6
        if review == "APPROVED":
            return 4
        if review in {"GV_CONFIRMED", "REVISION_REQUIRED", "REJECTED"} or _get(project, "signed_outline_file"):
            return 3
        return 2

    # Một số API cũ giữ nguyên status nhưng ghi topic_review_status=APPROVED
    # cùng đường dẫn đề cương đã ký. Đây là bằng chứng tương đương
    # OUTLINE_APPROVED và phải mở GĐ4.
    if review == "APPROVED" and (
        _get(project, "outline_pdf_path") or _get(project, "signed_outline_file")
    ):
        return 4

    if (
        status in OUTLINE_STAGE_STATUSES
        or review in {"GV_CONFIRMED", "APPROVED", "REVISION_REQUIRED"}
        or _get(project, "signed_outline_file")
    ):
        return 3
    # ALLOCATED (hoặc giá trị lạ): đã có đồ án nghĩa là đã được phân công GVHD.
    return 2


def _blocking_state(project):
    """Trả về (kind, reason) nếu đồ án bị dừng hẳn, ngược lại None."""
    if project is None:
        return None
    status = _get(project, "status", "")
    deferral = _get(project, "deferral_status", "NONE")
    initial = _get(project, "initial_eligibility", "")
    if status in DEFERRED_STATUSES or deferral == "APPROVED":
        return "deferred", "Đồ án đang được bảo lưu, không thể thao tác ở các giai đoạn tiếp theo."
    if status in DISQUALIFIED_STATUSES or initial == "DISQUALIFIED" or deferral == "REJECTED":
        return "disqualified", "Sinh viên đã bị loại khỏi đợt đồ án."
    if _outline_rejected(project):
        return "outline_rejected", "Đề cương đã bị đánh giá Không đạt."
    return None


def _outline_step(project):
    """Mô tả bước con trong GĐ3 (dùng cho lý do khóa GĐ4)."""
    status = _get(project, "status", "")
    review = _get(project, "topic_review_status", "")
    if status == "OUTLINE_REVISION" or review == "REVISION_REQUIRED" or status == "TOPIC_REVISION":
        if status == "TOPIC_REVISION":
            return "topic_revision", "Khoa yêu cầu chỉnh sửa đề tài."
        return "outline_revision", "Đề cương đang được yêu cầu chỉnh sửa."
    if status == "OUTLINE_PENDING" and review == "GV_CONFIRMED":
        return "outline_waiting_faculty", "GVHD đã duyệt, đề cương đang chờ Khoa phê duyệt."
    if status == "OUTLINE_PENDING":
        return "outline_waiting_supervisor", "Đề cương đã nộp, đang chờ GVHD duyệt."
    if status == "TOPIC_APPROVED":
        return "topic_approved", "Khoa đã duyệt đề tài, sinh viên cần nộp đề cương."
    if status in {"TOPIC_CONFIRMED", "PENDING_REVIEW"}:
        return "topic_waiting_faculty", "Đề tài đang chờ Khoa/GVHD phê duyệt."
    if status == "TOPIC_DRAFT":
        return "topic_draft", "Đề tài đang ở trạng thái nháp."
    return "outline_not_submitted", "Sinh viên chưa nộp đề cương."


def _locked_reason(number, project):
    """Lý do giai đoạn `number` (tương lai) đang bị khóa."""
    if number == 2:
        return "Khoa chưa mở giai đoạn khảo sát nguyện vọng."
    if number == 3:
        if project is None:
            return "Sinh viên chưa được phân công GVHD."
        return "Khoa chưa mở giai đoạn xây dựng đề cương."
    if number == 4:
        if project is None:
            return "Sinh viên chưa được phân công GVHD."
        return "Đề cương chưa được Khoa phê duyệt. " + _outline_step(project)[1]
    if number == 5:
        return "Khoa chưa chuyển đợt sang giai đoạn thực hiện đồ án (GĐ5)."
    if number == 6:
        return "GVHD chưa xác nhận hoàn thành giai đoạn thực hiện (GĐ5)."
    return "Giai đoạn chưa được mở."


def compute_project_progress(project=None, batch=None):
    """
    Tính tiến trình 6 giai đoạn chuẩn hóa cho một đồ án (hoặc sinh viên chưa có
    đồ án khi project=None). Trả về dict theo contract thống nhất cho Student,
    Supervisor và Admin.
    """
    batch = _project_batch(project, batch)
    batch_num = batch_stage_number(batch)
    closed_batch = batch_is_closed(batch)
    p_stage = achieved_stage(project)
    blocking = _blocking_state(project)

    cap = TOTAL_STAGES
    cap_reason = None
    if project is None:
        cap = 2
        cap_reason = "Sinh viên chưa được phân công GVHD."
    elif (
        _get(project, "initial_eligibility", "") == "INELIGIBLE"
        and p_stage < 6
        and not _get(project, "is_force_approved", False)
    ):
        cap = 4
        cap_reason = "Không đủ điều kiện làm đồ án, đang chờ Khoa xét đặc cách."

    if blocking:
        current = p_stage
    else:
        current = min(max(p_stage, batch_num), cap)
    current = max(1, min(TOTAL_STAGES, current))

    status_value = _get(project, "status", None) if project is not None else None
    is_finished = bool(project is not None and status_value in FINISHED_STATUSES and not blocking)
    defense_eligible = bool(
        project is not None
        and not blocking
        and (
            _get(project, "is_eligible_for_defense", False)
            or status_value in DEFENSE_STAGE_STATUSES
            or status_value in FINISHED_STATUSES
        )
        and _get(project, "final_academic_eligibility", "") != "INELIGIBLE"
        and _get(project, "deferral_status", "NONE") not in {"REQUESTED", "APPROVED", "REJECTED"}
    )

    stages = []
    for definition in PROJECT_STAGES:
        n = definition["number"]
        entry = {
            "number": n,
            "key": definition["key"],
            "label": definition["label"],
            "status": STATUS_LOCKED,
            "accessible": False,
            "editable": False,
            "reason": None,
        }
        if n < current:
            entry["accessible"] = True
            entry["status"] = STATUS_COMPLETED
            if n < p_stage or project is not None and n <= 2 or n >= batch_num:
                entry["reason"] = "Giai đoạn đã hoàn thành, chỉ được xem lại."
            else:
                entry["reason"] = (
                    f"Khoa đã chuyển đợt sang GĐ{batch_num}; giai đoạn này đã đóng, chỉ được xem lại."
                )
        elif n == current:
            entry["accessible"] = True
            entry["status"] = STATUS_ACTIVE
            if blocking:
                entry["reason"] = blocking[1]
            elif is_finished:
                entry["status"] = STATUS_COMPLETED
                entry["reason"] = "Đồ án đã bảo vệ và có kết quả cuối cùng."
            elif closed_batch:
                entry["reason"] = "Đợt đồ án đã đóng, chỉ được xem."
            elif n < batch_num:
                # Bị trần giữ lại trong khi đợt đã đi tiếp -> chỉ xem.
                entry["reason"] = cap_reason or f"Khoa đã chuyển đợt sang GĐ{batch_num}."
            else:
                entry["editable"] = True
                if n == 6 and not defense_eligible:
                    entry["reason"] = "Chưa đủ điều kiện bảo vệ: chỉ GVHD được đánh giá, phản biện/hội đồng chưa được chấm."
        else:
            if blocking:
                entry["reason"] = blocking[1]
            elif n > cap:
                entry["reason"] = cap_reason
            else:
                entry["reason"] = _locked_reason(n, project)
                if n > current + 1:
                    entry["reason"] = f"Cần hoàn thành GĐ{n - 1} trước. " + entry["reason"]
        stages.append(entry)

    completed_count = sum(1 for s in stages if s["status"] == STATUS_COMPLETED)
    overall_percent = 100 if is_finished else round(completed_count * 100 / TOTAL_STAGES)

    if blocking:
        step_key, step_label = blocking
    elif is_finished:
        step_key = "passed" if status_value == "PASSED" else "failed"
        step_label = "Đã bảo vệ: Đạt." if status_value == "PASSED" else "Đã bảo vệ: Không đạt."
    elif current == 3 and project is not None:
        step_key, step_label = _outline_step(project)
    elif current == 4 and cap == 4:
        step_key, step_label = "waiting_force_approval", cap_reason
    elif current == 6 and not defense_eligible:
        step_key, step_label = "defense_not_eligible", "Chưa đủ điều kiện bảo vệ."
    elif project is None and current >= 2:
        step_key, step_label = "awaiting_allocation", "Chưa được phân công GVHD."
    else:
        step_key, step_label = STAGE_KEYS[current], STAGE_LABELS[current]

    return {
        "contract_version": CONTRACT_VERSION,
        "current_stage_number": current,
        "current_stage_key": STAGE_KEYS[current],
        "current_stage_label": STAGE_LABELS[current],
        "current_step_key": step_key,
        "current_step_label": step_label,
        "overall_percent": overall_percent,
        "timeline_step": timeline_step_for_stage(current),
        "project_stage_number": p_stage,
        "batch_stage_number": batch_num,
        "project_status": status_value,
        "batch_status": _get(batch, "current_stage", None),
        "batch_closed": closed_batch,
        "has_project": project is not None,
        "is_blocked": bool(blocking),
        "blocked_reason": blocking[1] if blocking else None,
        "block_kind": blocking[0] if blocking else None,
        "is_finished": is_finished,
        "defense_eligible": defense_eligible,
        "stages": stages,
    }


def resolve_project_stage(project, batch=None):
    """Số giai đoạn hiện tại (1..6) theo contract."""
    return compute_project_progress(project, batch)["current_stage_number"]


def check_stage_write(project=None, required_stage=1, batch=None):
    """
    Kiểm tra thao tác GHI thuộc giai đoạn `required_stage`.
    Trả về None nếu được phép; ngược lại trả về dict lỗi (HTTP 409).
    """
    progress = compute_project_progress(project, batch)
    current = progress["current_stage_number"]
    stage = progress["stages"][required_stage - 1]

    if stage["editable"] and current == required_stage:
        return None

    if progress["is_blocked"]:
        detail = progress["blocked_reason"]
    elif progress["batch_closed"]:
        detail = "Đợt đồ án đã đóng, mọi giai đoạn chỉ được xem."
    elif current < required_stage:
        detail = (
            f"Giai đoạn {required_stage} chưa được mở. "
            f"Đợt hiện đang ở giai đoạn {current}. " + (stage["reason"] or "")
        ).strip()
    elif current > required_stage:
        detail = (
            f"Giai đoạn {required_stage} đã kết thúc và hiện chỉ được xem. "
            f"Đợt đã chuyển sang giai đoạn {current}."
        )
    else:
        detail = stage["reason"] or f"Giai đoạn {required_stage} hiện chỉ được xem."

    return {
        "detail": detail,
        "current_stage": current,
        "required_stage": required_stage,
        "read_only": current >= required_stage,
        "reason": stage["reason"],
        "workflow": progress,
    }


def check_defense_action(project, batch=None):
    """Phản biện/Hội đồng chỉ được chấm khi đồ án đang ở GĐ6 và đủ ĐK bảo vệ."""
    error = check_stage_write(project, 6, batch)
    if error:
        return error
    progress = compute_project_progress(project, batch)
    if not progress["defense_eligible"]:
        return {
            "detail": "Đồ án chưa đủ điều kiện bảo vệ, chưa thể chấm phản biện/hội đồng.",
            "current_stage": progress["current_stage_number"],
            "required_stage": 6,
            "read_only": True,
            "reason": "Chưa đủ điều kiện bảo vệ.",
            "workflow": progress,
        }
    return None
