from django.db import transaction
from app.models import (
    GraduationProject,
    DefenseCouncil,
    CouncilMember,
    Supervisor,
    AcademicBatch,
    AuditLog
)

class ReviewerAndCouncilAllocationEngine:
    """
    Phân bổ Đề tài vào Hội đồng bảo vệ và gán Giảng viên phản biện (Bước 40)
    Ràng buộc cứng:
    1. Giảng viên phản biện != Giảng viên hướng dẫn
    2. Giảng viên hướng dẫn KHÔNG được nằm trong Hội đồng chấm sinh viên của mình
    3. Cân bằng tải phản biện giữa các thành viên hội đồng
    """

    @classmethod
    def assign_councils_and_reviewers(cls, batch_id):
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {"success": False, "error": f"Không tìm thấy đợt ID {batch_id}."}

        projects = list(GraduationProject.objects.filter(
            batch=batch
        ).exclude(deferral_status="APPROVED").select_related('student__user', 'supervisor__user', 'topic_category'))
        
        councils = list(DefenseCouncil.objects.filter(batch=batch).prefetch_related('members__supervisor', 'members__user'))

        if not projects:
            return {"success": False, "error": "Không có đề tài đồ án nào hợp lệ để phân hội đồng trong đợt này."}

        if not councils:
            return {"success": False, "error": "Chưa thành lập Hội đồng bảo vệ cho đợt này."}

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

        # Target projects per council
        n_proj = len(projects)
        n_coun = len(councils)
        target_per_council = (n_proj + n_coun - 1) // n_coun

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
                if sup_id not in council_supervisors[c.id]:
                    valid_councils.append(c)

            # Sort valid councils by least assigned
            valid_councils.sort(key=lambda c: len(council_assigned_projects[c.id]))

            if valid_councils:
                assigned_council = valid_councils[0]
                council_assigned_projects[assigned_council.id].append(proj)
            else:
                conflicts.append({
                    "project_id": proj.id,
                    "student_name": proj.student.user.get_full_name(),
                    "registration_no": proj.student.registration_no,
                    "supervisor_name": proj.supervisor.user.get_full_name(),
                    "reason": "Tất cả các Hội đồng hiện có đều có GVHD của sinh viên tham gia (Trùng xung đột lợi ích)."
                })
                unassigned_count += 1

        # Step 2: Assign Reviewer from Council Members (Least Loaded, != Supervisor)
        assignments = []
        with transaction.atomic():
            for c in councils:
                c_projects = council_assigned_projects[c.id]
                candidates = council_reviewers[c.id]

                for proj in c_projects:
                    valid_revs = [rev for rev in candidates if rev.id != proj.supervisor_id]

                    if valid_revs:
                        valid_revs.sort(key=lambda rev: reviewer_load.get(rev.id, 0))
                        chosen_rev = valid_revs[0]
                        reviewer_load[chosen_rev.id] = reviewer_load.get(chosen_rev.id, 0) + 1

                        proj.council = c
                        proj.reviewer = chosen_rev
                        proj.save(update_fields=["council", "reviewer"])

                        assigned_count += 1
                        assignments.append({
                            "project_id": proj.id,
                            "student_name": proj.student.user.get_full_name(),
                            "registration_no": proj.student.registration_no,
                            "topic_title": proj.topic_title_vi,
                            "supervisor": proj.supervisor.user.get_full_name(),
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
            "conflicts": conflicts,
            "assignments": assignments
        }

    @classmethod
    def manual_override_reviewer(cls, project_id, council_id, reviewer_id, user=None):
        """Khoa điều chỉnh thủ công Hội đồng & Giảng viên phản biện cho sinh viên"""
        project = GraduationProject.objects.get(id=project_id)
        council = DefenseCouncil.objects.filter(id=council_id).first() if council_id else None
        reviewer = Supervisor.objects.filter(id=reviewer_id).first() if reviewer_id else None

        if reviewer and project.supervisor_id == reviewer.id:
            return {"success": False, "error": "Giảng viên phản biện không được trùng với Giảng viên hướng dẫn!"}

        if council and reviewer:
            # Kiểm tra xem GV phản biện có nằm trong hội đồng này không
            is_member = council.members.filter(supervisor=reviewer).exists()
            if not is_member:
                return {"success": False, "error": f"Giảng viên {reviewer.user.get_full_name()} không thuộc {council.council_name}."}

        project.council = council
        project.reviewer = reviewer
        project.save(update_fields=["council", "reviewer"])

        if user:
            AuditLog.objects.create(
                user=user,
                action_type="evaluation_update",
                description=f"Khoa đã điều chỉnh thủ công HĐ/Phản biện cho SV {project.student.registration_no}."
            )

        return {"success": True, "message": "Điều chỉnh thủ công Hội đồng & Phản biện thành công."}
