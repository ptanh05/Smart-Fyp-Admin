import math
from django.db import transaction
from django.db.models import Max

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
    def _can_form_council(cls, projects, all_supervisor_ids):
        """Kiểm tra nhóm đề tài có còn ít nhất 5 GV không phải GVHD hay không."""
        gvhd_ids = {p.supervisor_id for p in projects if p.supervisor_id}
        return len(all_supervisor_ids - gvhd_ids) >= cls.COUNCIL_SIZE

    @classmethod
    def _select_members(cls, projects, supervisors, load, quota_sup_ids):
        """
        Chọn 5 GV thành viên Hội đồng cho nhóm đề tài `projects`.

        Điều kiện bắt buộc: KHÔNG GV nào trong 5 người là GVHD của bất kỳ
        đề tài nào trong nhóm (tránh xung đột lợi ích).
        Ưu tiên mềm: tránh chọn GV đã là GVPB của đề tài trong nhóm (nếu có).

        Trả về list 5 Supervisor đã sắp xếp theo vai trò (Chủ tịch -> Thư ký -> Ủy viên)
        hoặc None nếu không tìm được đủ 5 người hợp lệ.
        """
        supervisor_ids = {p.supervisor_id for p in projects if p.supervisor_id}
        reviewer_ids = {p.reviewer_id for p in projects if p.reviewer_id}

        candidates = [
            s for s in supervisors
            if s.id not in supervisor_ids
        ]
        if len(candidates) < cls.COUNCIL_SIZE:
            return None

        candidates.sort(
            key=lambda s: (
                0 if s.id in reviewer_ids else 1,
                *cls._supervisor_priority(s, load, quota_sup_ids),
            ),
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
                key=lambda s: (
                    0 if s.id in reviewer_ids else 1,
                    *cls._supervisor_priority(s, load, quota_sup_ids),
                ),
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
        Bảo toàn các Hội đồng đã chốt điểm (is_finalized=True) và chia đều số lượng
        sinh viên giữa các Hội đồng (chênh lệch tối đa 1 sinh viên).

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

        # Loại trừ các đề tài đã bảo lưu hoặc đã nằm trong Hội đồng chốt điểm (is_finalized=True)
        projects = list(
            GraduationProject.objects.filter(batch=batch)
            .exclude(deferral_status="APPROVED")
            .exclude(council__is_finalized=True)
            .select_related("student__user", "supervisor__user")
            .order_by("student__registration_no")
        )

        if not projects:
            # Phân biệt đợt trống (chưa có đề tài) với đợt mà mọi đề tài đã chốt Hội đồng/bảo lưu.
            if not GraduationProject.objects.filter(batch=batch).exists():
                return {
                    "success": False,
                    "error": "Đợt này chưa có đề tài nào để thành lập Hội đồng.",
                }
            return {
                "success": False,
                "error": "Đợt này không còn đề tài nào chưa chốt Hội đồng để thành lập Hội đồng.",
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

        all_supervisor_ids = {s.id for s in supervisors}

        # Ưu tiên GV có quota trong đợt (đã tham gia đợt)
        quota_sup_ids = set(
            SupervisorQuota.objects.filter(batch=batch).values_list("supervisor_id", flat=True)
        )

        per_council = max(1, int(projects_per_council or 8))

        # ------------------------------------------------------------------
        # 2. Tính số Hội đồng mục tiêu K và phân bổ cân bằng (bin-balancing)
        # ------------------------------------------------------------------
        n_projects = len(projects)
        distinct_gvhds = {p.supervisor_id for p in projects if p.supervisor_id}
        max_distinct_per_council = len(supervisors) - cls.COUNCIL_SIZE
        if distinct_gvhds and max_distinct_per_council > 0:
            min_k_needed = math.ceil(len(distinct_gvhds) / max_distinct_per_council)
        else:
            min_k_needed = 1

        target_k = max(math.ceil(n_projects / per_council), min_k_needed, 1)
        target_k = min(target_k, n_projects)

        base_size = n_projects // target_k
        remainder = n_projects % target_k
        targets = [base_size + (1 if i < remainder else 0) for i in range(target_k)]

        # Nhóm đề tài theo GVHD (GVHD có nhiều SV xếp trước để dễ gom nhóm & cân bằng)
        gvhd_counts = {}
        for p in projects:
            gvhd_counts[p.supervisor_id] = gvhd_counts.get(p.supervisor_id, 0) + 1

        ordered_projects = sorted(
            projects,
            key=lambda p: (
                -gvhd_counts.get(p.supervisor_id, 0),
                p.supervisor_id or 0,
                p.student.registration_no or "",
            ),
        )

        buckets = [[] for _ in range(target_k)]
        bucket_gvhds = [set() for _ in range(target_k)]
        conflicts = []

        for proj in ordered_projects:
            sup_id = proj.supervisor_id

            # Kiểm tra xem bản thân đề tài này có thể lập hội đồng độc lập hay không
            if not cls._can_form_council([proj], all_supervisor_ids):
                conflicts.append({
                    "project_id": proj.id,
                    "student_name": proj.student.user.get_full_name(),
                    "registration_no": proj.student.registration_no,
                    "reason": (
                        "Không đủ 05 giảng viên không trùng GVHD để lập "
                        "Hội đồng chấm đề tài này."
                    ),
                })
                continue

            # Tìm các bucket hợp lệ (không vi phạm ràng buộc 5 GVHD độc lập)
            valid_under_target = []
            valid_any = []
            for idx in range(len(buckets)):
                trial_gvhds = bucket_gvhds[idx] | ({sup_id} if sup_id else set())
                if len(all_supervisor_ids - trial_gvhds) < cls.COUNCIL_SIZE:
                    continue
                same_gvhd_bonus = 0 if (sup_id and sup_id in bucket_gvhds[idx]) else 1
                key = (len(buckets[idx]), same_gvhd_bonus, len(trial_gvhds), idx)
                valid_any.append((key, idx))
                if len(buckets[idx]) < targets[idx]:
                    valid_under_target.append((key, idx))

            if valid_under_target:
                valid_under_target.sort(key=lambda item: item[0])
                chosen_idx = valid_under_target[0][1]
                buckets[chosen_idx].append(proj)
                if sup_id:
                    bucket_gvhds[chosen_idx].add(sup_id)
            elif valid_any:
                valid_any.sort(key=lambda item: item[0])
                chosen_idx = valid_any[0][1]
                buckets[chosen_idx].append(proj)
                if sup_id:
                    bucket_gvhds[chosen_idx].add(sup_id)
            else:
                # Mở thêm 1 hội đồng mới nếu không bucket nào chứa được do xung đột GVHD
                buckets.append([proj])
                bucket_gvhds.append({sup_id} if sup_id else set())
                targets.append(per_council)

        # Loại bỏ bucket rỗng (nếu có)
        buckets = [b for b in buckets if b]

        # ------------------------------------------------------------------
        # 2b. Rebalancing pass: cân bằng kích thước chênh lệch tối đa 1 SV
        # ------------------------------------------------------------------
        if len(buckets) > 1:
            max_passes = n_projects * 2
            for _ in range(max_passes):
                sizes = [len(b) for b in buckets]
                if max(sizes) - min(sizes) <= 1:
                    break

                moved = False
                # Sắp xếp cặp (src nhiều SV nhất -> dst ít SV nhất)
                src_indices = sorted(range(len(buckets)), key=lambda i: len(buckets[i]), reverse=True)
                dst_indices = sorted(range(len(buckets)), key=lambda i: len(buckets[i]))

                for src_i in src_indices:
                    for dst_i in dst_indices:
                        if src_i == dst_i or len(buckets[src_i]) - len(buckets[dst_i]) <= 1:
                            continue

                        dst_gvhds = {p.supervisor_id for p in buckets[dst_i] if p.supervisor_id}
                        # Ưu tiên chuyển SV có GVHD đã tồn tại ở dst để không tăng xung đột
                        candidate_projs = sorted(
                            buckets[src_i],
                            key=lambda p: (0 if (p.supervisor_id and p.supervisor_id in dst_gvhds) else 1),
                        )
                        for p in candidate_projs:
                            trial_dst_gvhds = dst_gvhds | ({p.supervisor_id} if p.supervisor_id else set())
                            if len(all_supervisor_ids - trial_dst_gvhds) >= cls.COUNCIL_SIZE:
                                buckets[src_i].remove(p)
                                buckets[dst_i].append(p)
                                moved = True
                                break
                        if moved:
                            break
                    if moved:
                        break

                if not moved:
                    break

        created_councils = []
        assignments = []
        supervisor_council_load = {}

        # Khởi tạo tải từ các Hội đồng đã chốt điểm (is_finalized=True)
        for m in CouncilMember.objects.filter(
            council__batch=batch, council__is_finalized=True, supervisor__isnull=False
        ):
            supervisor_council_load[m.supervisor_id] = supervisor_council_load.get(m.supervisor_id, 0) + 1

        with transaction.atomic():
            # Xóa các hội đồng cũ (chưa chấm điểm / chưa chốt) để tránh trùng lặp khi bấm lại nút
            old_councils = DefenseCouncil.objects.filter(batch=batch, is_finalized=False)
            old_council_ids = list(old_councils.values_list("id", flat=True))
            if old_council_ids:
                GraduationProject.objects.filter(council_id__in=old_council_ids).update(
                    council=None, reviewer=None
                )
                DefenseCouncil.objects.filter(id__in=old_council_ids).delete()

            existing_max_num = (
                DefenseCouncil.objects.filter(batch=batch, is_finalized=True)
                .aggregate(max_num=Max("council_number"))
                .get("max_num")
                or 0
            )
            council_number = existing_max_num
            new_council_ids = []

            for chunk in buckets:
                ranked = cls._select_members(
                    chunk, supervisors, supervisor_council_load, quota_sup_ids
                )
                if not ranked:
                    for proj in chunk:
                        conflicts.append({
                            "project_id": proj.id,
                            "student_name": proj.student.user.get_full_name(),
                            "registration_no": proj.student.registration_no,
                            "reason": (
                                "Không đủ 05 giảng viên không trùng GVHD để lập "
                                "Hội đồng chấm đề tài này."
                            ),
                        })
                    continue

                council_number += 1
                role_map = ["CHAIR", "SECRETARY", "SECRETARY", "MEMBER", "MEMBER"]

                council = DefenseCouncil.objects.create(
                    batch=batch,
                    council_number=council_number,
                    council_name=f"Hội đồng {council_number} - {batch.batch_code}",
                    defense_room=f"{defense_room_prefix}{council_number:02d}",
                    session_date=session_date or batch.start_date,
                    session_time=session_time,
                )
                new_council_ids.append(council.id)

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
                    "projects_count": len(chunk),
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

            # ------------------------------------------------------------------
            # 4. Gán Giảng viên phản biện (GVPB ≠ GVHD, ưu tiên ít bận nhất)
            #    Chỉ áp dụng cho các Hội đồng mới tạo (không ghi đè HĐ đã chốt)
            # ------------------------------------------------------------------
            reviewer_load = {}
            assigned_reviewers = 0

            for council in DefenseCouncil.objects.filter(id__in=new_council_ids).prefetch_related(
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
