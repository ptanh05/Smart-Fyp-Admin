import collections
from django.db import transaction
from app.models import (
    Student,
    Supervisor,
    SupervisorQuota,
    InternshipInfo,
    GraduationProject,
    AcademicBatch,
    ProjectTopicArea
)

class MinCostMaxFlowAllocationEngine:
    """
    Min-Cost Max-Flow (MCMF) Matching Engine for Supervisor Allocation.
    Maximizes preference and department compatibility while strictly respecting Lecturer Quotas.
    """

    class Edge:
        def __init__(self, to, cap, flow, cost, rev):
            self.to = to
            self.cap = cap
            self.flow = flow
            self.cost = cost
            self.rev = rev

    @classmethod
    def allocate_supervisors_for_batch(cls, batch_id):
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {"success": False, "error": f"Batch {batch_id} not found."}

        # 1. Fetch all students in batch
        students = list(Student.objects.filter(academic_batch=batch).select_related('course_class', 'user'))
        if not students:
            return {
                "success": True,
                "matched_count": 0,
                "unassigned_count": 0,
                "matched": [],
                "unassigned": [],
                "message": "Không có sinh viên nào trong đợt này."
            }

        # 2. Fetch all supervisor quotas in batch
        quotas = list(SupervisorQuota.objects.filter(batch=batch).select_related('supervisor__user'))
        if not quotas:
            return {
                "success": False,
                "error": "Chưa thiết lập định mức Quota cho giảng viên trong đợt này."
            }

        # Fetch all internship / preference surveys
        surveys = {info.student_id: info for info in InternshipInfo.objects.filter(batch=batch).select_related('topic_direction', 'preferred_supervisor')}

        # Map department topics
        dept_topic_affinity = {
            "CNPM": ["SOFTWARE_DEV", "SOFTWARE_TESTING", "GAME_DEV"],
            "Mạng&HTTT": ["NETWORK_INFRA", "CYBER_SECURITY", "SOFTWARE_DEV"],
            "KHMT": ["AI_DATA", "ALGORITHMS", "GAME_DEV", "SOFTWARE_DEV"],
            "Thỉnh giảng": ["AI_DATA", "SOFTWARE_DEV", "GAME_DEV"]
        }

        # Build MCMF Graph
        # Node IDs:
        # Source: 0
        # Students: 1 to N
        # Supervisors: N + 1 to N + M
        # Sink: N + M + 1
        n_students = len(students)
        n_supervisors = len(quotas)
        source = 0
        sink = n_students + n_supervisors + 1
        num_nodes = sink + 1

        adj = [[] for _ in range(num_nodes)]

        def add_edge(u, v, cap, cost):
            forward = cls.Edge(v, cap, 0, cost, len(adj[v]))
            backward = cls.Edge(u, 0, 0, -cost, len(adj[u]))
            adj[u].append(forward)
            adj[v].append(backward)

        # 1. Edges Source -> Student
        for idx, student in enumerate(students, start=1):
            add_edge(source, idx, 1, 0)

        # 2. Edges Student -> Supervisor
        for s_idx, student in enumerate(students, start=1):
            survey = surveys.get(student.id)
            pref_sup_id = survey.preferred_supervisor_id if survey else None
            topic_code = survey.topic_direction.code if (survey and survey.topic_direction) else "SOFTWARE_DEV"
            is_viet_anh = student.course_class and student.course_class.program_type == "VIET_ANH"

            for g_idx, q in enumerate(quotas, start=n_students + 1):
                sup = q.supervisor
                dept = q.department or sup.department_name or ""

                # Base cost
                cost = 0

                # Student explicitly requested this supervisor
                if pref_sup_id and pref_sup_id == sup.id:
                    cost -= 100

                # Topic affinity
                aff_topics = dept_topic_affinity.get(dept, [])
                if topic_code in aff_topics:
                    cost -= 50

                # Regular faculty preferred over visiting
                if dept != "Thỉnh giảng":
                    cost -= 10

                # Viet-Anh affinity if lecturer has VA quota
                if is_viet_anh and q.viet_anh_quota > 0:
                    cost -= 30

                add_edge(s_idx, g_idx, 1, cost)

        # 3. Edges Supervisor -> Sink (Capacity = available quota)
        for g_idx, q in enumerate(quotas, start=n_students + 1):
            # Calculate remaining capacity
            rem_quota = max(0, q.max_total_quota)
            add_edge(g_idx, sink, rem_quota, 0)

        # Run SPFA / Bellman-Ford MCMF
        flow = 0
        total_cost = 0
        INF = float('inf')

        while True:
            dist = [INF] * num_nodes
            parent_node = [-1] * num_nodes
            parent_edge = [-1] * num_nodes
            in_queue = [False] * num_nodes

            dist[source] = 0
            queue = collections.deque([source])
            in_queue[source] = True

            while queue:
                u = queue.popleft()
                in_queue[u] = False

                for e_idx, edge in enumerate(adj[u]):
                    if edge.cap - edge.flow > 0 and dist[edge.to] > dist[u] + edge.cost:
                        dist[edge.to] = dist[u] + edge.cost
                        parent_node[edge.to] = u
                        parent_edge[edge.to] = e_idx
                        if not in_queue[edge.to]:
                            queue.append(edge.to)
                            in_queue[edge.to] = True

            if dist[sink] == INF:
                break

            # Find maximum flow along path
            push = INF
            curr = sink
            while curr != source:
                p = parent_node[curr]
                e = parent_edge[curr]
                push = min(push, adj[p][e].cap - adj[p][e].flow)
                curr = p

            # Apply flow
            curr = sink
            while curr != source:
                p = parent_node[curr]
                e = parent_edge[curr]
                rev_e = adj[p][e].rev
                adj[p][e].flow += push
                adj[curr][rev_e].flow -= push
                curr = p

            flow += push
            total_cost += push * dist[sink]

        # Extract matches
        matched_results = []
        unassigned_students = []
        assigned_student_ids = set()

        with transaction.atomic():
            for s_idx, student in enumerate(students, start=1):
                matched_sup = None
                for edge in adj[s_idx]:
                    if edge.to > n_students and edge.to <= n_students + n_supervisors and edge.flow > 0:
                        q_idx = edge.to - (n_students + 1)
                        matched_sup = quotas[q_idx].supervisor
                        break

                survey = surveys.get(student.id)
                topic_category = survey.topic_direction if survey else None
                tentative_title = survey.tentative_title if survey else f"Đồ án tốt nghiệp - {student.registration_no}"

                if matched_sup:
                    assigned_student_ids.add(student.id)
                    # Create or update GraduationProject
                    proj, _ = GraduationProject.objects.update_or_create(
                        student=student,
                        defaults={
                            "supervisor": matched_sup,
                            "batch": batch,
                            "topic_category": topic_category,
                            "topic_title_vi": tentative_title or f"Đề tài tốt nghiệp của {student.user.get_full_name()}",
                            "status": "ALLOCATED"
                        }
                    )
                    matched_results.append({
                        "student_id": student.id,
                        "student_name": student.user.get_full_name() or student.user.username,
                        "registration_no": student.registration_no,
                        "supervisor_id": matched_sup.id,
                        "supervisor_name": f"{matched_sup.academic_title or ''} {matched_sup.user.get_full_name()}".strip(),
                        "department": matched_sup.department_name,
                        "project_id": proj.id
                    })
                else:
                    unassigned_students.append({
                        "student_id": student.id,
                        "student_name": student.user.get_full_name() or student.user.username,
                        "registration_no": student.registration_no,
                        "reason": "Vượt quá chỉ tiêu Quota của tất cả Giảng viên phù hợp."
                    })

            # Update assigned counts in SupervisorQuota
            for q in quotas:
                actual_assigned = GraduationProject.objects.filter(batch=batch, supervisor=q.supervisor).count()
                q.current_assigned = actual_assigned
                q.save(update_fields=["current_assigned"])

        return {
            "success": True,
            "matched_count": len(matched_results),
            "unassigned_count": len(unassigned_students),
            "matched": matched_results,
            "unassigned": unassigned_students,
            "total_students": len(students)
        }
