from django.db import transaction
from django.db.models import Q
from app.models import (
    GraduationProject,
    DefenseCouncil,
    DefenseScheduleSlot,
    CouncilMember,
    Supervisor,
    AcademicBatch,
    AuditLog
)

class ReviewerAndCouncilAllocationEngine:
    """
    Phân bổ Đề tài vào Hội đồng bảo vệ và gán Giảng viên phản biện (Bước 40)
    Ràng buộc cứng:
    1. Chỉ phân bổ cho các sinh viên đã ĐỦ ĐIỀU KIỆN BẢO VỆ (GĐ6)
    2. Giảng viên phản biện != Giảng viên hướng dẫn
    3. Giảng viên hướng dẫn KHÔNG được nằm trong Hội đồng chấm sinh viên của mình
    4. Cân bằng tải phản biện giữa các thành viên hội đồng
    """

    @classmethod
    def assign_councils_and_reviewers(cls, batch_id):
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {"success": False, "error": f"Không tìm thấy đợt ID {batch_id}."}

        eligible_q = (
            Q(is_eligible_for_defense=True)
            | Q(supervisor_defense_confirmed=True)
            | Q(status__in=["DEFENSE_READY", "DEFENDING", "PASSED", "FAILED"])
        )
        all_batch_qs = (
            GraduationProject.objects.filter(batch=batch, student__isnull=False)
            .exclude(deferral_status="APPROVED")
            .exclude(status__in=["DEFERRED", "DISQUALIFIED"])
        )
        total_batch_projects = all_batch_qs.count()

        # Dọn sạch gán HĐ/GVPB/Slot cũ của sinh viên CHƯA đủ điều kiện bảo vệ (đang ở GĐ1-GĐ5)
        ineligible_ids = list(
            GraduationProject.objects.filter(batch=batch)
            .exclude(council__is_finalized=True)
            .filter(
                ~eligible_q
                | Q(final_academic_eligibility="INELIGIBLE")
                | Q(deferral_status="APPROVED")
                | Q(status__in=["DEFERRED", "DISQUALIFIED"])
            )
            .values_list("id", flat=True)
        )
        if ineligible_ids:
            DefenseScheduleSlot.objects.filter(project_id__in=ineligible_ids).delete()
            GraduationProject.objects.filter(id__in=ineligible_ids).update(council=None, reviewer=None)

        projects = list(
            all_batch_qs.filter(eligible_q)
            .exclude(final_academic_eligibility="INELIGIBLE")
            .exclude(council__is_finalized=True)
            .select_related('student__user', 'supervisor__user', 'topic_category')
        )
        skipped_ineligible_count = max(0, total_batch_projects - len(projects))

        councils = list(DefenseCouncil.objects.filter(batch=batch, is_finalized=False).prefetch_related('members__supervisor', 'members__user'))

        if not projects:
            if total_batch_projects > 0:
                return {
                    "success": False,
                    "error": (
                        f"Đợt này hiện có 0/{total_batch_projects} sinh viên đủ điều kiện bảo vệ "
                        f"({total_batch_projects} sinh viên vẫn đang ở GĐ1–GĐ5 hoặc chưa được xác nhận đủ điều kiện bảo vệ)."
                    ),
                    "skipped_ineligible_count": total_batch_projects,
                    "total_batch_projects": total_batch_projects,
                }
            return {"success": False, "error": "Không có đề tài đồ án nào đủ điều kiện bảo vệ để phân hội đồng trong đợt này."}

        if not councils:
            return {"success": False, "error": "Chưa thành lập Hội đồng bảo vệ (hoặc toàn bộ Hội đồng đã chốt điểm) cho đợt này."}

        # Map each council to its supervisor IDs and member list
        council_supervisors = {}
        council_reviewers = {}
        for c in councils:
            sup_ids = set()
            rev_candidates = []
            for m in c.members.all():
                if m.supervisor:
                    sup_ids.add(m.supervisor.id)
                    rev_candidates.append(m.supervisor)
            council_supervisors[c.id] = sup_ids
            council_reviewers[c.id] = rev_candidates

        # Target projects per council (balanced distribution, differing by at most 1)
        n_proj = len(projects)
        n_coun = len(councils)
        target_per_council = (n_proj + n_coun - 1) // n_coun
        base_per_council = n_proj // n_coun
        rem_per_council = n_proj % n_coun
        council_targets = {
            c.id: base_per_council + (1 if idx < rem_per_council else 0)
            for idx, c in enumerate(councils)
        }

        council_assigned_projects = {c.id: [] for c in councils}
        reviewer_load = {}  # supervisor_id -> count
        assigned_count = 0
        unassigned_count = 0
        conflicts = []

        # Step 1: Assign Project to Council without Conflict of Interest
        for proj in projects:
            assigned_council = None
            sup_id = proj.supervisor_id

            # Find valid councils where supervisor is NOT a member
            valid_councils = []
            for c in councils:
                if sup_id is None or sup_id not in council_supervisors[c.id]:
                    valid_councils.append(c)

            # Prefer councils still under their balanced target (and <= target_per_council), then least assigned
            valid_councils.sort(
                key=lambda c: (
                    0 if len(council_assigned_projects[c.id]) < council_targets[c.id] else (
                        1 if len(council_assigned_projects[c.id]) < target_per_council else 2
                    ),
                    len(council_assigned_projects[c.id]),
                )
            )

            if valid_councils:
                assigned_council = valid_councils[0]
                council_assigned_projects[assigned_council.id].append(proj)
            else:
                sup_name = proj.supervisor.user.get_full_name() if proj.supervisor else "Chưa phân công"
                conflicts.append({
                    "project_id": proj.id,
                    "student_name": proj.student.user.get_full_name(),
                    "registration_no": proj.student.registration_no,
                    "supervisor_name": sup_name,
                    "reason": "Tất cả các Hội đồng hiện có đều có GVHD của sinh viên tham gia (Trùng xung đột lợi ích)."
                })
                unassigned_count += 1

        # Step 2: Assign Reviewer from Council Members (Least Loaded, != Supervisor)
        assignments = []
        with transaction.atomic():
            from app.models import Supervisor, SupervisorQuota, CouncilMember as CM, GraduationProject as GP

            batch_sup_ids = (
                set(SupervisorQuota.objects.filter(batch=batch).values_list("supervisor_id", flat=True))
                | set(GP.objects.filter(batch=batch, supervisor__isnull=False).values_list("supervisor_id", flat=True))
                | set(CM.objects.filter(council__batch=batch, supervisor__isnull=False).values_list("supervisor_id", flat=True))
            )
            all_batch_sups = list(Supervisor.objects.filter(id__in=batch_sup_ids, is_active=True)) if batch_sup_ids else []

            for c in councils:
                c_projects = council_assigned_projects[c.id]
                candidates = council_reviewers[c.id]
                council_sup_ids = set(
                    CM.objects.filter(council=c, supervisor__isnull=False).values_list("supervisor_id", flat=True)
                )

                for proj in c_projects:
                    # 1) Ưu tiên GVPB ngoài hội đồng (tránh xung đột lợi ích trong hội đồng)
                    external_valid = [
                        rev for rev in all_batch_sups
                        if rev.id != proj.supervisor_id and rev.id not in council_sup_ids
                    ]
                    if external_valid:
                        external_valid.sort(key=lambda rev: reviewer_load.get(rev.id, 0))
                        chosen_rev = external_valid[0]
                    else:
                        valid_revs = [rev for rev in candidates if rev.id != proj.supervisor_id]

                        if valid_revs:
                            valid_revs.sort(key=lambda rev: reviewer_load.get(rev.id, 0))
                            chosen_rev = valid_revs[0]
                        else:
                            chosen_rev = None

                    if chosen_rev is not None:
                        reviewer_load[chosen_rev.id] = reviewer_load.get(chosen_rev.id, 0) + 1

                        proj.council = c
                        proj.reviewer = chosen_rev
                        proj.save(update_fields=["council", "reviewer"])

                        assigned_count += 1
                        sup_name = proj.supervisor.user.get_full_name() if proj.supervisor else "Chưa phân công"
                        assignments.append({
                            "project_id": proj.id,
                            "student_name": proj.student.user.get_full_name(),
                            "registration_no": proj.student.registration_no,
                            "topic_title": proj.topic_title_vi,
                            "supervisor": sup_name,
                            "council_name": c.council_name,
                            "reviewer": f"{chosen_rev.academic_title or ''} {chosen_rev.user.get_full_name()}".strip()
                        })
                    else:
                        conflicts.append({
                            "project_id": proj.id,
                            "student_name": proj.student.user.get_full_name(),
                            "registration_no": proj.student.registration_no,
                            "reason": f"Không có Giảng viên phản biện hợp lệ trong {c.council_name}."
                        })
                        unassigned_count += 1

        return {
            "success": True,
            "assigned_count": assigned_count,
            "unassigned_count": unassigned_count,
            "skipped_ineligible_count": skipped_ineligible_count,
            "total_batch_projects": total_batch_projects,
            "conflicts": conflicts,
            "assignments": assignments
        }

    @classmethod
    def manual_override_reviewer(cls, project_id, council_id, reviewer_id, user=None):
        """Khoa điều chỉnh thủ công Hội đồng & Giảng viên phản biện cho sinh viên"""
        project = GraduationProject.objects.select_related("supervisor__user", "student", "council").get(id=project_id)
        council = DefenseCouncil.objects.filter(id=council_id).first() if council_id else None
        reviewer = Supervisor.objects.filter(id=reviewer_id).first() if reviewer_id else None

        if project.council and getattr(project.council, "is_finalized", False):
            return {"success": False, "error": f"Hội đồng hiện tại ({project.council.council_name}) đã chốt điểm nên không thể thay đổi."}

        if council and getattr(council, "is_finalized", False):
            return {"success": False, "error": f"Hội đồng đích ({council.council_name}) đã chốt điểm nên không thể chuyển sinh viên vào."}

        # Chỉ cho phép gán vào Hội đồng khi sinh viên đã đủ điều kiện bảo vệ (GĐ6)
        is_eligible = bool(
            project.is_eligible_for_defense
            or project.supervisor_defense_confirmed
            or project.status in ("DEFENSE_READY", "DEFENDING", "PASSED", "FAILED")
        )
        if (council or reviewer) and (
            not is_eligible
            or project.deferral_status == "APPROVED"
            or project.status in ("DEFERRED", "DISQUALIFIED")
            or project.final_academic_eligibility == "INELIGIBLE"
        ):
            reg_no = project.student.registration_no if project.student else f"#{project.id}"
            return {
                "success": False,
                "error": (
                    f"Sinh viên {reg_no} hiện chưa đủ điều kiện bảo vệ "
                    f"(trạng thái: {project.get_status_display()}) nên chưa thể gán vào Hội đồng / Phản biện GĐ6."
                ),
            }

        if reviewer and project.supervisor_id == reviewer.id:
            return {"success": False, "error": "Giảng viên phản biện không được trùng với Giảng viên hướng dẫn!"}

        if council and project.supervisor_id:
            if council.members.filter(supervisor_id=project.supervisor_id).exists():
                sup_name = project.supervisor.user.get_full_name() if project.supervisor else "GVHD"
                return {
                    "success": False,
                    "error": f"Xung đột lợi ích (COI): Giảng viên hướng dẫn ({sup_name}) là thành viên của {council.council_name}."
                }

        if council and reviewer:
            # Kiểm tra xem GV phản biện có nằm trong hội đồng này không
            is_member = council.members.filter(supervisor=reviewer).exists()
            if not is_member:
                return {"success": False, "error": f"Giảng viên {reviewer.user.get_full_name()} không thuộc {council.council_name}."}

        old_council_id = project.council_id
        project.council = council
        project.reviewer = reviewer
        project.save(update_fields=["council", "reviewer"])

        # Nếu đổi hoặc gỡ Hội đồng thì xóa slot lịch cũ của hội đồng trước
        if old_council_id != (council.id if council else None):
            DefenseScheduleSlot.objects.filter(project=project).delete()

        if user:
            AuditLog.objects.create(
                user=user,
                action_type="evaluation_update",
                description=f"Khoa đã điều chỉnh thủ công HĐ/Phản biện cho SV {project.student.registration_no}."
            )

        return {"success": True, "message": "Điều chỉnh thủ công Hội đồng & Phản biện thành công."}
