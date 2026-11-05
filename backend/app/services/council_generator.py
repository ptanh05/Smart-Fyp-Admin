from django.db import transaction

from app.models import (
    AcademicBatch,
    AuditLog,
    CouncilMember,
    DefenseCouncil,
    GraduationProject,
    Supervisor,
    SupervisorQuota,
)


class CouncilGeneratorEngine:
    """
    Tự động thành lập Hội đồng bảo vệ theo mô hình chuẩn UTC:
        1 Chủ tịch - 2 Thư ký - 2 Ủy viên (tổng 5 thành viên)

    Nguyên tắc:
    - Chủ tịch: ưu tiên GV có học vị cao nhất (PGS/GS > TS > ThS).
    - Ưu tiên GV đang có quota trong đợt (đã tham gia đợt) và đang hoạt động.
    - Tự động loại trừ GVHD của sinh viên được xếp vào hội đồng đó
      (xử lý ở bước gom đề tài + chọn thành viên).
    - GVPB (Giảng viên phản biện) luôn khác GVHD.
    - Mỗi GV chỉ tham gia tối đa `max_councils_per_supervisor` hội đồng
      để tránh tình trạng quá tải giảng viên.
    """

    #: Số hội đồng tối đa mà 1 giảng viên có thể tham gia
    MAX_COUNCILS_PER_SUPERVISOR = 2

    #: Số thành viên chuẩn của một Hội đồng (1CT - 2TK - 2UV)
    COUNCIL_SIZE = 5

    #: Xếp hạng học vị để chọn Chủ tịch hội đồng
    TITLE_RANK = {
        "GS": 5, "GS.TS": 5, "PGS": 4, "PGS.TS": 4, "TS": 3, "TS.NV": 3,
        "ThS": 2, "ThS.NV": 2, "TSc": 2, "Cử nhân": 1,
        "Thạc sĩ": 2, "Tiến sĩ": 3, "Giáo viên": 0, "GV": 0,
    }

    @classmethod
    def _title_rank(cls, supervisor):
        title = (supervisor.academic_title or "").strip()
        if not title:
            return 0
        if title in cls.TITLE_RANK:
            return cls.TITLE_RANK[title]
        upper = title.upper()
        for key, rank in cls.TITLE_RANK.items():
            if key.upper() in upper:
                return rank
        return 1

    @classmethod
    def _supervisor_priority(cls, supervisor, load, quota_sup_ids):
        """Khóa sắp xếp ưu tiên: GV có quota > học vị cao > ít bận > hệ số."""
        return (
            1 if supervisor.id in quota_sup_ids else 0,
            cls._title_rank(supervisor),
            -load.get(supervisor.id, 0),
            supervisor.academic_rank_multiplier or 0,
        )

    @classmethod
    def _select_members(cls, projects, supervisors, load, quota_sup_ids):
        """
        Chọn 5 GV thành viên Hội đồng cho nhóm đề tài `projects`.

        Điều kiện bắt buộc: KHÔNG GV nào trong 5 người là GVHD của bất kỳ
        đề tài nào trong nhóm (tránh xung đột lợi ích).

        Trả về list 5 Supervisor đã sắp xếp theo vai trò (Chủ tịch -> Thư ký -> Ủy viên)
        hoặc None nếu không tìm được đủ 5 người hợp lệ.
        """
        supervisor_ids = {p.supervisor_id for p in projects if p.supervisor_id}

        candidates = [
            s for s in supervisors
            if s.id not in supervisor_ids
        ]
        if len(candidates) < cls.COUNCIL_SIZE:
            return None

        candidates.sort(
            key=lambda s: cls._supervisor_priority(s, load, quota_sup_ids),
            reverse=True,
        )

        # Ưu tiên GV ít bận nhất nhưng vẫn bảo đảm học vị cao để làm Chủ tịch.
        # Lấy 5 người có điểm ưu tiên cao nhất, sau đó sắp xếp lại theo học vị
        # để phân vai Chủ tịch / Thư ký / Ủy viên.
        selected = candidates[:cls.COUNCIL_SIZE]

        # Cân bằng tải: nếu 5 người ưu tiên cao nhất đều đã quá tải, thay thế
        # bằng người ít bận hơn (nhưng vẫn không phải GVHD của nhóm).
        overloaded = [
            s for s in selected
            if load.get(s.id, 0) >= cls.MAX_COUNCILS_PER_SUPERVISOR
        ]
        if overloaded:
            spare = sorted(
                [s for s in candidates[cls.COUNCIL_SIZE:]
                 if load.get(s.id, 0) < cls.MAX_COUNCILS_PER_SUPERVISOR],
                key=lambda s: cls._supervisor_priority(s, load, quota_sup_ids),
                reverse=True,
            )
            for busy in overloaded:
                if spare:
                    selected[selected.index(busy)] = spare.pop(0)
                else:
                    break

        # Sắp xếp theo học vị để phân vai
        return sorted(
            selected,
            key=lambda s: (cls._title_rank(s), s.academic_rank_multiplier or 0),
            reverse=True,
        )

    @classmethod
    def generate_councils_for_batch(
        cls,
        batch_id,
        projects_per_council=8,
        defense_room_prefix="P",
        session_date=None,
        session_time="MORNING",
        user=None,
    ):
        """
        Tự động sinh Hội đồng + gán đề tài + gán phản biện trong 1 lần bấm nút.

        Returns dict:
        {
            "success": bool,
            "error": str | None,
            "message": str,
            "councils": [...],
            "assigned_projects": int,
            "assigned_reviewers": int,
            "conflicts": [...],
        }
        """
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {"success": False, "error": f"Không tìm thấy đợt ID {batch_id}."}

        projects = list(
            GraduationProject.objects.filter(batch=batch)
            .exclude(deferral_status="APPROVED")
            .select_related("student__user", "supervisor__user")
            .order_by("student__registration_no")
        )

        if not projects:
            return {
                "success": False,
                "error": "Đợt này chưa có đề tài nào để thành lập Hội đồng.",
            }

        # ------------------------------------------------------------------
        # 1. Gom GV theo học vị (Chủ tịch / Thư ký / Ủy viên)
        # ------------------------------------------------------------------
        supervisors = list(
            Supervisor.objects.filter(user__is_active=True)
            .select_related("user")
            .order_by("-academic_rank_multiplier", "user__last_name", "user__first_name")
        )
        if len(supervisors) < cls.COUNCIL_SIZE:
            return {
                "success": False,
                "error": (
                    "Cần ít nhất 05 Giảng viên đang hoạt động để thành lập "
                    "Hội đồng chuẩn (1CT-2TK-2UV)."
                ),
            }

        # Ưu tiên GV có quota trong đợt (đã tham gia đợt)
        quota_sup_ids = set(
            SupervisorQuota.objects.filter(batch=batch).values_list("supervisor_id", flat=True)
        )

        per_council = max(1, int(projects_per_council or 8))

        created_councils = []
        assignments = []
        conflicts = []
        supervisor_council_load = {}

        # Sắp xếp đề tài theo GVHD để gom nhóm đề tài cùng GVHD vào một HĐ
        remaining = sorted(
            projects,
            key=lambda p: (p.supervisor_id or 0, p.student.registration_no or ""),
        )

        with transaction.atomic():
            # Xóa các hội đồng cũ (chưa chấm điểm) để tránh trùng lặp khi bấm lại nút
            old_councils = DefenseCouncil.objects.filter(batch=batch, is_finalized=False)
            old_council_ids = list(old_councils.values_list("id", flat=True))
            if old_council_ids:
                GraduationProject.objects.filter(council_id__in=old_council_ids).update(
                    council=None, reviewer=None
                )
                DefenseCouncil.objects.filter(id__in=old_council_ids).delete()

            council_number = 0
            while remaining:
                council_number += 1

                # --- 3a. Gom nhóm đề tài mà vẫn tìm được 5 GV không xung đột ---
                chunk = []
                rest = []
                for proj in remaining:
                    if len(chunk) >= per_council:
                        rest.append(proj)
                        continue
                    trial = chunk + [proj]
                    if cls._select_members(
                        trial, supervisors, supervisor_council_load, quota_sup_ids
                    ):
                        chunk = trial
                    else:
                        rest.append(proj)

                if not chunk:
                    # Không tìm được HĐ nào chứa được các đề tài còn lại
                    for proj in remaining:
                        conflicts.append({
                            "project_id": proj.id,
                            "student_name": proj.student.user.get_full_name(),
                            "registration_no": proj.student.registration_no,
                            "reason": (
                                "Không đủ 05 giảng viên không trùng GVHD để lập "
                                "Hội đồng chấm đề tài này."
                            ),
                        })
                    break

                # --- 3b. Chọn 5 thành viên: GV cao học vị làm Chủ tịch ---
                ranked = cls._select_members(
                    chunk, supervisors, supervisor_council_load, quota_sup_ids
                )
                role_map = ["CHAIR", "SECRETARY", "SECRETARY", "MEMBER", "MEMBER"]

                council = DefenseCouncil.objects.create(
                    batch=batch,
                    council_number=council_number,
                    council_name=f"Hội đồng {council_number} - {batch.batch_code}",
                    defense_room=f"{defense_room_prefix}{council_number:02d}",
                    session_date=session_date or batch.start_date,
                    session_time=session_time,
                )

                for sup, role in zip(ranked, role_map):
                    CouncilMember.objects.create(
                        council=council,
                        supervisor=sup,
                        user=sup.user,
                        role=role,
                    )
                    supervisor_council_load[sup.id] = supervisor_council_load.get(sup.id, 0) + 1

                created_councils.append({
                    "id": council.id,
                    "council_number": council_number,
                    "council_name": council.council_name,
                    "defense_room": council.defense_room,
                    "members": [
                        {
                            "role": role,
                            "name": sup.user.get_full_name(),
                            "academic_title": sup.academic_title or "",
                        }
                        for sup, role in zip(ranked, role_map)
                    ],
                })

                # --- 3c. Gán đề tài vào hội đồng ---
                for proj in chunk:
                    proj.council = council
                    proj.save(update_fields=["council"])
                    assignments.append({
                        "project_id": proj.id,
                        "council_id": council.id,
                        "council_name": council.council_name,
                        "student_name": proj.student.user.get_full_name(),
                        "registration_no": proj.student.registration_no,
                    })

                remaining = rest

            # ------------------------------------------------------------------
            # 4. Gán Giảng viên phản biện (GVPB ≠ GVHD, ưu tiên ít bận nhất)
            # ------------------------------------------------------------------
            reviewer_load = {}
            assigned_reviewers = 0

            for council in DefenseCouncil.objects.filter(batch=batch).prefetch_related(
                "members__supervisor"
            ):
                candidates = [m.supervisor for m in council.members.all() if m.supervisor]
                council_projects = list(
                    GraduationProject.objects.filter(council=council)
                    .select_related("student__user", "supervisor__user")
                )

                for proj in council_projects:
                    valid = [s for s in candidates if s.id != proj.supervisor_id]
                    if not valid:
                        conflicts.append({
                            "project_id": proj.id,
                            "student_name": proj.student.user.get_full_name(),
                            "registration_no": proj.student.registration_no,
                            "reason": (
                                f"Không có GVPB hợp lệ trong {council.council_name} "
                                "(GVHD là thành viên HĐ)."
                            ),
                        })
                        continue
                    valid.sort(key=lambda s: reviewer_load.get(s.id, 0))
                    chosen = valid[0]
                    reviewer_load[chosen.id] = reviewer_load.get(chosen.id, 0) + 1
                    proj.reviewer = chosen
                    proj.save(update_fields=["reviewer"])
                    assigned_reviewers += 1

            if user:
                AuditLog.objects.create(
                    user=user,
                    action_type="group_status_change",
                    description=(
                        f"Khoa đã tự động thành lập {len(created_councils)} Hội đồng (1CT-2TK-2UV) "
                        f"cho Đợt #{batch_id}: Gán {len(assignments)} đề tài, "
                        f"{assigned_reviewers} GVPB."
                    ),
                )

        return {
            "success": True,
            "message": (
                f"Đã tạo {len(created_councils)} Hội đồng (1CT-2TK-2UV), "
                f"gán {len(assignments)} đề tài và {assigned_reviewers} Giảng viên phản biện."
            ),
            "councils": created_councils,
            "assigned_projects": len(assignments),
            "assigned_reviewers": assigned_reviewers,
            "conflicts": conflicts,
        }
