import collections
from typing import Any
from django.db import transaction
from django.utils import timezone
from app.models import (
    Student,
    Supervisor,
    SupervisorQuota,
    InternshipInfo,
    StudentPreference,
    GraduationProject,
    AcademicBatch,
    ProjectTopicArea,
    AuditLog
)

class MinCostMaxFlowAllocationEngine:
    """
    Min-Cost Max-Flow (MCMF) Matching Engine for Supervisor Allocation.
    Tuân thủ quy trình nghiệp vụ Giai đoạn 2:
    1. Hard Constraint: Nếu SV thuộc CT Kỹ sư (ENGINEER), GVHD bắt buộc phải đạt học vị tối thiểu (TS trở lên).
    2. Soft Constraint: Tối ưu theo nguyện vọng NV1 (-120), NV2 (-70), NV3 (-40), độ phù hợp chuyên môn bộ môn (-30).
    3. Capacity: Tính toán theo hệ số học vị (GS/PGS/TS/ThS).
    """

    LOCKED_PROJECT_STATUSES = {
        "IN_PROGRESS",
        "DEFENSE_READY",
        "DEFENSE_COMPLETED",
        "COMPLETED",
        "TOPIC_APPROVED",
    }

    DEPT_TOPIC_AFFINITY = {
        "CNPM": ["SOFTWARE_DEV", "SOFTWARE_TESTING", "GAME_DEV"],
        "MHTTT": ["NETWORK_INFRA", "CYBER_SECURITY", "SOFTWARE_DEV"],
        "KHMT": ["AI_DATA", "ALGORITHMS", "GAME_DEV", "SOFTWARE_DEV"],
        "Thỉnh giảng": ["AI_DATA", "SOFTWARE_DEV", "GAME_DEV"],
    }

    @classmethod
    def _normalize_department(cls, dept_name):
        """Chuẩn hóa tên bộ môn (hỗ trợ cả mã viết tắt lẫn tên đầy đủ tiếng Việt)."""
        raw = (dept_name or "").strip()
        if not raw:
            return ""
        low = raw.lower()
        if low in {"cnpm", "ktpm"} or "phần mềm" in low or "phan mem" in low:
            return "CNPM"
        if low in {"mhttt", "mạng&httt", "mạng & httt", "ktmt"} or "mạng" in low or "mang" in low or "hệ thống thông tin" in low or "he thong thong tin" in low:
            return "MHTTT"
        if low in {"khmt"} or "khoa học máy tính" in low or "khoa hoc may tinh" in low:
            return "KHMT"
        if "thỉnh giảng" in low or "thinh giang" in low:
            return "Thỉnh giảng"
        return raw

    class Edge:
        def __init__(self, to, cap, flow, cost, rev):
            self.to = to
            self.cap = cap
            self.flow = flow
            self.cost = cost
            self.rev = rev

    @classmethod
    def allocate_supervisors_for_batch(cls, batch_id, only_unassigned=False) -> dict[str, Any]:
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {"success": False, "error": f"Không tìm thấy đợt đồ án ID {batch_id}."}

        # 1. Fetch all students in batch
        students = list(
            Student.objects.filter(academic_batch=batch)
            .select_related('course_class', 'user', 'graduation_project')
        )
        if not students:
            return {
                "success": True,
                "matched_count": 0,
                "preserved_count": 0,
                "newly_matched_count": 0,
                "unassigned_count": 0,
                "matched": [],
                "unassigned": [],
                "message": "Không có sinh viên nào trong đợt này."
            }

        # Khấu trừ các đồ án đã khóa trạng thái (hoặc toàn bộ SV đã có GVHD khi chạy bổ sung)
        locked_qs = GraduationProject.objects.filter(batch=batch)
        if only_unassigned:
            locked_qs = locked_qs.filter(supervisor__isnull=False)
        else:
            locked_qs = locked_qs.filter(status__in=cls.LOCKED_PROJECT_STATUSES)

        locked_projects = list(locked_qs.select_related('student__user', 'supervisor__user'))
        locked_student_ids = {p.student_id for p in locked_projects if p.student_id}
        locked_count_by_sup = collections.Counter(
            p.supervisor_id for p in locked_projects if p.supervisor_id
        )

        # Chỉ chạy MCMF cho các sinh viên chưa có đồ án bị khóa trạng thái / chưa phân công
        allocatable_students = [s for s in students if s.id not in locked_student_ids]

        if only_unassigned and not allocatable_students:
            preserved = []
            for proj in locked_projects:
                if not proj.student or not proj.supervisor:
                    continue
                st = proj.student
                sup = proj.supervisor
                preserved.append({
                    "student_id": st.id,
                    "student_name": st.user.get_full_name() or st.user.username,
                    "registration_no": st.registration_no,
                    "education_program": st.education_program,
                    "supervisor_id": sup.id,
                    "supervisor_name": f"{sup.academic_title or ''} {sup.user.get_full_name()}".strip(),
                    "academic_title": sup.academic_title or "",
                    "department": sup.department_name,
                    "project_id": proj.id,
                })
            return {
                "success": True,
                "only_unassigned": True,
                "matched_count": len(preserved),
                "preserved_count": len(preserved),
                "newly_matched_count": 0,
                "unassigned_count": 0,
                "matched": preserved,
                "unassigned": [],
                "total_students": len(students),
                "message": "Toàn bộ sinh viên trong đợt đã được phân công GVHD.",
            }

        # 2. Fetch active supervisor quotas in batch (filter active users)
        quotas = list(
            SupervisorQuota.objects.filter(batch=batch, supervisor__user__is_active=True)
            .select_related('supervisor__user')
            .prefetch_related('supervisor__topic_area_links__topic_area')
        )
        if not quotas:
            return {
                "success": False,
                "error": "Chưa thiết lập định mức Quota cho giảng viên đang hoạt động trong đợt này."
            }

        for q in quotas:
            if q.max_total_quota is None:
                q.calculate_capacity()
                q.save(update_fields=["max_total_quota"])

        # Fetch student preferences (NV1, NV2, NV3) or legacy internship info
        preferences = {pref.student_id: pref for pref in StudentPreference.objects.filter(batch=batch).select_related(
            'topic_direction', 'preference_1', 'preference_2', 'preference_3'
        )}
        surveys = {info.student_id: info for info in InternshipInfo.objects.filter(batch=batch).select_related(
            'topic_direction'
        )}

        # Chuyên ngành / lĩnh vực mà từng GV đã đăng ký (Supervisor.topic_area_links)
        sup_topic_codes = {}
        for q in quotas:
            sup = q.supervisor
            sup_topic_codes[sup.id] = {
                link.topic_area.code
                for link in sup.topic_area_links.all()
                if link.topic_area and link.topic_area.code
            }

        # Build MCMF Graph
        n_students = len(allocatable_students)
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
        for idx in range(1, n_students + 1):
            add_edge(source, idx, 1, 0)

        # 2. Edges Student -> Supervisor
        disqualified_pairs = 0
        for s_idx, student in enumerate(allocatable_students, start=1):
            pref = preferences.get(student.id)
            survey = surveys.get(student.id)

            p1_id = pref.preference_1_id if pref else (survey.preferred_supervisor.id if survey and survey.preferred_supervisor else None)
            p2_id = pref.preference_2_id if pref else None
            p3_id = pref.preference_3_id if pref else None

            topic_code = ""
            if pref and pref.topic_direction:
                topic_code = pref.topic_direction.code
            elif survey and survey.topic_direction:
                topic_code = survey.topic_direction.code
            else:
                topic_code = "SOFTWARE_DEV"

            is_engineer = (student.education_program == "ENGINEER") or (batch.program_type == "ENGINEER")
            is_viet_anh = student.course_class and student.course_class.program_type == "VIET_ANH"
            cpa_bonus = int(float(getattr(student, "cpa", 0) or 0) * 3)

            for g_idx, q in enumerate(quotas, start=n_students + 1):
                sup = q.supervisor

                # Hard Constraint: Kiểm tra chương trình Kỹ sư -> Giảng viên phải đạt học vị tối thiểu (TS trở lên)
                if is_engineer and not sup.is_eligible_for_engineer():
                    disqualified_pairs += 1
                    continue  # Bỏ qua cạnh này, không cho phép ghép nối

                norm_dept = cls._normalize_department(q.department or sup.department_name or "")
                cost = 0

                # Trọng số theo thứ tự nguyện vọng NV1 -> NV2 -> NV3 (+ điểm ưu tiên CPA nhỏ khi trùng nguyện vọng)
                if p1_id and p1_id == sup.id:
                    cost -= 120 + cpa_bonus
                elif p2_id and p2_id == sup.id:
                    cost -= 70 + cpa_bonus
                elif p3_id and p3_id == sup.id:
                    cost -= 40 + cpa_bonus

                # Độ phù hợp theo hướng đề tài: ưu tiên khớp trực tiếp topic_area_links, sau đó theo bộ môn chuẩn hóa
                if topic_code and topic_code in sup_topic_codes.get(sup.id, set()):
                    cost -= 35
                else:
                    aff_topics = cls.DEPT_TOPIC_AFFINITY.get(norm_dept, [])
                    if topic_code in aff_topics:
                        cost -= 30

                # Giảng viên cơ hữu ưu tiên hơn thỉnh giảng
                if norm_dept != "Thỉnh giảng" and not sup.is_external:
                    cost -= 10

                # Ưu tiên lớp Việt - Anh nếu giảng viên có định mức VA
                if is_viet_anh and q.viet_anh_quota > 0:
                    cost -= 25

                add_edge(s_idx, g_idx, 1, cost)

        # 3. Edges Supervisor -> Sink (piecewise convex unit-capacity edges for fair load balancing)
        for g_idx, q in enumerate(quotas, start=n_students + 1):
            locked_cnt = locked_count_by_sup.get(q.supervisor_id, 0)
            rem_quota = max(0, (q.max_total_quota or 0) - locked_cnt)
            for k in range(rem_quota):
                add_edge(g_idx, sink, 1, (locked_cnt + k) * 8)

        # SPFA / MCMF
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

            push = INF
            curr = sink
            while curr != source:
                p = parent_node[curr]
                e = parent_edge[curr]
                push = min(push, adj[p][e].cap - adj[p][e].flow)
                curr = p

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

        # Trích xuất kết quả đề xuất
        preserved_results = []
        matched_results = []
        unassigned_students = []

        # Bảo toàn thông tin các sinh viên có đồ án đã khóa
        for proj in locked_projects:
            if not proj.student or not proj.supervisor:
                continue
            st = proj.student
            sup = proj.supervisor
            item = {
                "student_id": st.id,
                "student_name": st.user.get_full_name() or st.user.username,
                "registration_no": st.registration_no,
                "education_program": st.education_program,
                "supervisor_id": sup.id,
                "supervisor_name": f"{sup.academic_title or ''} {sup.user.get_full_name()}".strip(),
                "academic_title": sup.academic_title or "",
                "department": sup.department_name,
                "project_id": proj.id,
            }
            preserved_results.append(item)
            matched_results.append(item)

        with transaction.atomic():
            for s_idx, student in enumerate(allocatable_students, start=1):
                matched_sup = None
                for edge in adj[s_idx]:
                    if edge.to > n_students and edge.to <= n_students + n_supervisors and edge.flow > 0:
                        q_idx = edge.to - (n_students + 1)
                        matched_sup = quotas[q_idx].supervisor
                        break

                pref = preferences.get(student.id)
                survey = surveys.get(student.id)
                topic_category = (pref.topic_direction if pref else None) or (survey.topic_direction if survey else None)
                # Allocation assigns a GVHD only.  Do not turn a survey answer
                # into an official topic; the supervisor creates/confirms it.
                tentative_title = ""

                if matched_sup:
                    existing_proj = GraduationProject.objects.filter(student=student).first()
                    if existing_proj:
                        # Nếu đồ án đã qua Giai đoạn 2 (đang thực hiện, bảo vệ, duyệt đề tài), bảo toàn trạng thái
                        if existing_proj.status not in cls.LOCKED_PROJECT_STATUSES:
                            existing_proj.supervisor = matched_sup
                            existing_proj.batch = batch
                            existing_proj.status = "ALLOCATED"
                            if topic_category and not existing_proj.topic_category:
                                existing_proj.topic_category = topic_category
                            if not existing_proj.topic_title_vi:
                                existing_proj.topic_title_vi = tentative_title
                            existing_proj.save()
                        proj = existing_proj
                    else:
                        proj = GraduationProject.objects.create(
                            student=student,
                            supervisor=matched_sup,
                            batch=batch,
                            topic_category=topic_category,
                            topic_title_vi=tentative_title,
                            status="ALLOCATED",
                            topic_review_status="DRAFT"
                        )

                    matched_results.append({
                        "student_id": student.id,
                        "student_name": student.user.get_full_name() or student.user.username,
                        "registration_no": student.registration_no,
                        "education_program": student.education_program,
                        "supervisor_id": matched_sup.id,
                        "supervisor_name": f"{matched_sup.academic_title or ''} {matched_sup.user.get_full_name()}".strip(),
                        "academic_title": matched_sup.academic_title or "",
                        "department": matched_sup.department_name,
                        "project_id": proj.id
                    })
                else:
                    reason = "Vượt quá chỉ tiêu Quota của các Giảng viên phù hợp."
                    if (student.education_program == "ENGINEER" or batch.program_type == "ENGINEER"):
                        reason += " Lưu ý: SV hệ Kỹ sư yêu cầu GVHD có học vị tối thiểu là Tiến sĩ (TS)."

                    unassigned_students.append({
                        "student_id": student.id,
                        "student_name": student.user.get_full_name() or student.user.username,
                        "registration_no": student.registration_no,
                        "education_program": student.education_program,
                        "reason": reason
                    })

            # Cập nhật số lượng đã phân công
            for q in quotas:
                actual_assigned = GraduationProject.objects.filter(batch=batch, supervisor=q.supervisor).count()
                q.current_assigned = actual_assigned
                q.save(update_fields=["current_assigned"])

            # Cập nhật trạng thái đợt sang Giai đoạn 2
            if batch.current_stage == "PHASE_1_SETUP":
                batch.current_stage = "PHASE_2_ALLOCATING"
                batch.save(update_fields=["current_stage"])

        return {
            "success": True,
            "only_unassigned": bool(only_unassigned),
            "matched_count": len(matched_results),
            "preserved_count": len(preserved_results),
            "newly_matched_count": len(matched_results) - len(preserved_results),
            "unassigned_count": len(unassigned_students),
            "matched": matched_results,
            "unassigned": unassigned_students,
            "total_students": len(students)
        }

    @classmethod
    def finalize_allocation(cls, batch_id, user=None):
        """Khoa chốt phân công đề tài (Bước 17)"""
        batch = AcademicBatch.objects.get(id=batch_id)

        if getattr(batch, "supplementary_open", False):
            return {
                "success": False,
                "error": "Đợt đồ án đang mở đăng ký bổ sung. Vui lòng chốt phân công bổ sung trước khi khóa danh sách."
            }

        from app.services.stage_deadline_enforcement import enforce_batch_stage_deadlines
        enforce_batch_stage_deadlines(batch, actor_user=user, max_stage=2)

        allocated_qs = GraduationProject.objects.filter(batch=batch, supervisor__isnull=False)
        if not allocated_qs.exists():
            return {
                "success": False,
                "error": "Không thể chốt phân công vì chưa có sinh viên nào được phân công Giảng viên hướng dẫn."
            }

        allocated_student_ids = set(allocated_qs.values_list("student_id", flat=True))
        unassigned_count = (
            Student.objects.filter(academic_batch=batch, user__is_active=True)
            .exclude(id__in=allocated_student_ids)
            .count()
        )
        if unassigned_count > 0:
            return {
                "success": False,
                "error": f"Không thể chốt phân công vì vẫn còn {unassigned_count} sinh viên chưa được phân công Giảng viên hướng dẫn."
            }

        batch.current_stage = "PHASE_2_LOCKED"
        batch.save(update_fields=["current_stage"])

        if user:
            AuditLog.objects.create(
                user=user,
                action_type="supervisor_request_update",
                description=f"Khoa đã chốt phân công giảng viên hướng dẫn cho Đợt {batch.batch_code}."
            )
        return {"success": True, "message": "Đã chốt danh sách phân công GVHD thành công."}

    @classmethod
    def publish_and_notify_allocation(cls, batch_id, user=None):
        """Công bố và gửi email kết quả phân công (Bước 18 & 19)"""
        batch = AcademicBatch.objects.get(id=batch_id)
        if getattr(batch, "supplementary_open", False):
            return {
                "success": False,
                "error": "Đợt đồ án đang mở đăng ký bổ sung. Vui lòng chốt phân công bổ sung trước khi công bố kết quả."
            }
        if batch.current_stage != "PHASE_2_LOCKED":
            if batch.is_allocation_published:
                return {
                    "success": False,
                    "error": "Đợt đồ án này đã được công bố kết quả phân công trước đó."
                }
            return {
                "success": False,
                "error": "Khoa cần nhấn 'Khoa Chốt Phân Công' trước khi thực hiện công bố và phát lệnh thông báo."
            }
        batch.is_allocation_published = True
        batch.allocation_published_at = timezone.now()
        batch.current_stage = "PHASE_3_TOPIC"
        batch.save(update_fields=["is_allocation_published", "allocation_published_at", "current_stage"])

        from app.models import Notification

        # 1. Tạo thông báo cho toàn bộ Giảng viên và Sinh viên trong đợt
        projects = GraduationProject.objects.filter(
            batch=batch, student__isnull=False, supervisor__isnull=False
        ).select_related("student__user", "supervisor__user")

        sup_students_map = collections.defaultdict(list)
        for p in projects:
            st = p.student
            st_u = st.user
            st_name = f"{st_u.last_name} {st_u.first_name}".strip() if (st_u.last_name or st_u.first_name) else (st_u.get_full_name() or st_u.username)
            sup_students_map[p.supervisor].append(f"{st.registration_no} - {st_name}")

        batch_quotas = SupervisorQuota.objects.filter(batch=batch).select_related("supervisor__user")
        all_batch_supervisors = set(sup_students_map.keys()) | {q.supervisor for q in batch_quotas if q.supervisor}

        notifs = []
        batch_name_display = batch.batch_name or batch.batch_code

        # Thông báo cho từng Giảng viên hướng dẫn
        for sup in all_batch_supervisors:
            if not sup or not sup.user:
                continue
            students_list = sup_students_map.get(sup, [])
            count = len(students_list)
            sup_title = sup.academic_title or "Thầy/Cô"
            sup_name = sup.user.get_full_name() or sup.user.username

            if count > 0:
                preview = ", ".join(students_list[:4])
                if count > 4:
                    preview += f" và {count - 4} sinh viên khác"
                title = f"🎉 [Kết quả phân công GVHD] Danh sách sinh viên hướng dẫn - {batch_name_display}"
                msg = (
                    f"Kính gửi {sup_title} {sup_name},\n"
                    f"Khoa CNTT đã chính thức công bố kết quả phân công Giảng viên hướng dẫn cho Đợt '{batch_name_display}'.\n"
                    f"Thầy/Cô được phân công hướng dẫn {count} sinh viên: {preview}.\n"
                    f"Vui lòng truy cập Cổng Giảng viên để theo dõi danh sách chi tiết và phối hợp cùng sinh viên xây dựng bản thảo đề tài (Giai đoạn 3)."
                )
                action_url = "/supervisor/dashboard?tab=utc_graduation&subtab=students"
            else:
                title = f"📢 [Kết quả phân công GVHD] Thông báo đợt - {batch_name_display}"
                msg = (
                    f"Kính gửi {sup_title} {sup_name},\n"
                    f"Khoa CNTT đã công bố kết quả phân công GVHD cho Đợt '{batch_name_display}'.\n"
                    f"Trong đợt này, Thầy/Cô hiện chưa được phân công sinh viên nào."
                )
                action_url = "/supervisor/dashboard?tab=utc_graduation"

            notifs.append(
                Notification(
                    user=sup.user,
                    title=title,
                    message=msg,
                    action_url=action_url,
                    notification_type="system",
                    is_read=False,
                )
            )

        # Thông báo cho từng Sinh viên được phân công
        for p in projects:
            st = p.student
            if not st or not st.user:
                continue
            sup = p.supervisor
            sup_title = sup.academic_title or "Thầy/Cô"
            sup_name = sup.user.get_full_name() or sup.user.username
            st_title = f"🎉 [Kết quả phân công GVHD] Bạn đã được phân công Giảng viên hướng dẫn - {batch_name_display}"
            st_msg = (
                f"Chúc mừng bạn! Khoa đã công bố kết quả phân công ĐATN đợt '{batch_name_display}'.\n"
                f"Bạn được phân công {sup_title} {sup_name} ({sup.department_name or 'Bộ môn CNTT'}) hướng dẫn.\n"
                f"Hãy liên hệ ngay với GVHD để thống nhất hướng đề tài và xây dựng đề cương (Giai đoạn 3)."
            )
            notifs.append(
                Notification(
                    user=st.user,
                    title=st_title,
                    message=st_msg,
                    action_url="/student/dashboard?tab=utc_graduation&subtab=project",
                    notification_type="system",
                    is_read=False,
                )
            )

        if notifs:
            Notification.objects.bulk_create(notifs)

        if user:
            AuditLog.objects.create(
                user=user,
                action_type="group_status_change",
                description=f"Khoa đã công bố và phát lệnh thông báo kết quả phân công cho Đợt {batch.batch_code}."
            )
        return {
            "success": True,
            "message": "Đã công bố và gửi thông báo kết quả phân công cho toàn bộ Giảng viên và Sinh viên."
        }
