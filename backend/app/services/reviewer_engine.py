from django.db import transaction
from app.models import (
    GraduationProject,
    DefenseCouncil,
    CouncilMember,
    Supervisor,
    AcademicBatch
)

class ReviewerAndCouncilAllocationEngine:
    """
    Allocates Projects to Defense Councils and assigns Reviewers under STRICT Hard Constraints:
    1. Supervisor(S) != Reviewer(S)
    2. Supervisor(S) NOT IN CouncilMembers(Council(S))
    3. Balanced review load among available council reviewers
    """

    @classmethod
    def assign_councils_and_reviewers(cls, batch_id):
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {"success": False, "error": f"Batch ID {batch_id} not found."}

        projects = list(GraduationProject.objects.filter(batch=batch).select_related('student__user', 'supervisor__user', 'topic_category'))
        councils = list(DefenseCouncil.objects.filter(batch=batch).prefetch_related('members__supervisor', 'members__user'))

        if not projects:
            return {"success": False, "error": "Không có đề tài đồ án nào trong đợt này."}

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
                    # check capacity
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
                    "reason": "Tất cả các Hội đồng hiện có đều có GVHD của sinh viên tham gia."
                })
                unassigned_count += 1

        # Step 2: Assign Reviewer from Council Members (Least Loaded, != Supervisor)
        assignments = []
        with transaction.atomic():
            for c in councils:
                c_projects = council_assigned_projects[c.id]
                candidates = council_reviewers[c.id]

                for proj in c_projects:
                    # Valid reviewer candidates in this council: supervisor != proj.supervisor
                    valid_revs = [rev for rev in candidates if rev.id != proj.supervisor_id]

                    if valid_revs:
                        # Pick least loaded reviewer
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
