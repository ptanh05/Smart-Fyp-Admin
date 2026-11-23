import collections
import datetime
from django.db import transaction
from app.models import (
    AcademicBatch,
    DefenseCouncil,
    GraduationProject,
    DefenseScheduleSlot,
    AuditLog
)


class DefenseSchedulerEngine:
    """
    Tự động xếp lịch bảo vệ chi tiết (Bước 41):
    Xếp lịch đa ca / đa ngày không xung đột thành viên Hội đồng (Graph Coloring / Greedy Slot Assignment):
    - Mỗi slot là một cặp (session_date, shift) với shift thuộc ("MORNING", "AFTERNOON").
    - Không một thành viên Hội đồng nào bị trùng lịch giữa 2 hội đồng trong cùng 1 (ngày, ca).
    - Mỗi hội đồng trong cùng (ngày, ca) được gán phòng bảo vệ riêng biệt (P01, P02, ...).
    - Ghi ngược session_date, session_time, defense_room vào DefenseCouncil và tạo các DefenseScheduleSlot chi tiết.
    """

    SHIFTS = ("MORNING", "AFTERNOON")

    @classmethod
    def _parse_start_date(cls, start_date, batch):
        if isinstance(start_date, datetime.date) and not isinstance(start_date, datetime.datetime):
            return start_date
        if isinstance(start_date, datetime.datetime):
            return start_date.date()
        if isinstance(start_date, str) and start_date.strip():
            return datetime.date.fromisoformat(start_date.strip())
        return batch.start_date or (datetime.date.today() + datetime.timedelta(days=1))

    @classmethod
    def schedule_defense_for_batch(
        cls,
        batch_id,
        slot_duration_minutes=40,
        morning_start_str="08:00",
        afternoon_start_str="13:30",
        start_date=None,
        user=None
    ):
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {"success": False, "error": f"Không tìm thấy đợt ID {batch_id}."}

        try:
            base_start_date = cls._parse_start_date(start_date, batch)
        except ValueError:
            return {"success": False, "error": "Định dạng ngày bắt đầu (start_date) không hợp lệ. Vui lòng dùng YYYY-MM-DD."}

        councils = list(
            DefenseCouncil.objects.filter(batch=batch)
            .prefetch_related("members")
            .order_by("council_number")
        )
        if not councils:
            return {"success": False, "error": "Chưa có Hội đồng bảo vệ nào được thành lập trong đợt này."}

        # Tập thành viên của từng Hội đồng để kiểm tra trùng lịch
        council_member_keys = {}
        for c in councils:
            keys = set()
            for m in c.members.all():
                if m.user_id:
                    keys.add(f"u:{m.user_id}")
                if m.supervisor_id:
                    keys.add(f"s:{m.supervisor_id}")
            council_member_keys[c.id] = keys

        # Sắp xếp Hội đồng theo bậc xung đột (số HĐ chung thành viên & tổng số thành viên trùng) giảm dần
        def conflict_sort_key(c):
            my_keys = council_member_keys[c.id]
            overlap_councils = 0
            overlap_members = 0
            for other in councils:
                if other.id == c.id:
                    continue
                shared = len(my_keys & council_member_keys[other.id])
                if shared > 0:
                    overlap_councils += 1
                    overlap_members += shared
            return (-overlap_councils, -overlap_members, c.council_number)

        ordered_councils = sorted(councils, key=conflict_sort_key)

        booked_members = collections.defaultdict(set)  # (date, shift) -> set of member keys
        used_rooms = collections.defaultdict(set)      # (date, shift) -> set of room strings

        scheduled_slots = []
        council_schedules = []
        total_projects = 0

        with transaction.atomic():
            # Xóa các slot cũ trước khi xếp lại
            DefenseScheduleSlot.objects.filter(council__batch=batch).delete()

            for council in ordered_councils:
                my_keys = council_member_keys[council.id]

                # Tìm cặp (date, shift) sớm nhất không có thành viên nào bị trùng lịch
                assigned_date = None
                assigned_shift = None
                day_offset = 0
                while assigned_date is None:
                    cand_date = base_start_date + datetime.timedelta(days=day_offset)
                    for shift in cls.SHIFTS:
                        slot_key = (cand_date, shift)
                        if not (my_keys & booked_members[slot_key]):
                            assigned_date = cand_date
                            assigned_shift = shift
                            break
                    day_offset += 1

                slot_key = (assigned_date, assigned_shift)
                booked_members[slot_key].update(my_keys)

                # Chọn phòng bảo vệ duy nhất chưa được sử dụng trong (date, shift) này
                room_num = 1
                while f"P{room_num:02d}" in used_rooms[slot_key]:
                    room_num += 1
                assigned_room = f"P{room_num:02d}"
                used_rooms[slot_key].add(assigned_room)

                # Ghi ngược lịch bảo vệ vào DefenseCouncil
                council.session_date = assigned_date
                council.session_time = assigned_shift
                council.defense_room = assigned_room
                council.save(update_fields=["session_date", "session_time", "defense_room"])

                council_schedules.append({
                    "council_id": council.id,
                    "council_number": council.council_number,
                    "council_name": council.council_name,
                    "session_date": str(assigned_date),
                    "session_time": assigned_shift,
                    "defense_room": assigned_room,
                })

                projects = list(
                    GraduationProject.objects.filter(
                        council=council,
                        is_eligible_for_defense=True
                    ).exclude(deferral_status="APPROVED").select_related("student__user").order_by("student__registration_no")
                )

                # Nếu chưa có dự án được lọc theo is_eligible_for_defense, lấy tất cả dự án không bảo lưu trong council
                if not projects:
                    projects = list(
                        GraduationProject.objects.filter(
                            council=council
                        ).exclude(deferral_status="APPROVED").select_related("student__user").order_by("student__registration_no")
                    )

                if not projects:
                    continue

                is_afternoon = (assigned_shift == "AFTERNOON")
                start_hour_str = afternoon_start_str if is_afternoon else morning_start_str
                cur_h, cur_m = map(int, start_hour_str.split(":"))
                cur_time = datetime.time(hour=cur_h, minute=cur_m)

                for idx, proj in enumerate(projects, start=1):
                    start_dt = datetime.datetime.combine(assigned_date, cur_time)
                    end_dt = start_dt + datetime.timedelta(minutes=slot_duration_minutes)
                    end_time = end_dt.time()

                    slot = DefenseScheduleSlot.objects.create(
                        council=council,
                        project=proj,
                        order_number=idx,
                        slot_date=assigned_date,
                        start_time=cur_time,
                        end_time=end_time,
                        room=assigned_room
                    )

                    scheduled_slots.append({
                        "council_id": council.id,
                        "council_name": council.council_name,
                        "session_time": assigned_shift,
                        "order": idx,
                        "student_name": proj.student.user.get_full_name(),
                        "registration_no": proj.student.registration_no,
                        "topic_title": proj.topic_title_vi,
                        "slot_date": str(assigned_date),
                        "start_time": cur_time.strftime("%H:%M"),
                        "end_time": end_time.strftime("%H:%M"),
                        "room": slot.room
                    })

                    cur_time = end_time
                    total_projects += 1

            if user:
                AuditLog.objects.create(
                    user=user,
                    action_type="group_status_change",
                    description=f"Khoa đã chạy thuật toán tự động xếp lịch bảo vệ cho Đợt #{batch_id}: Tổng cộng {total_projects} đồ án."
                )

        scheduled_slots.sort(key=lambda s: (s["slot_date"], s["start_time"], s["room"], s["order"]))
        council_schedules.sort(key=lambda c: (c["session_date"], 0 if c["session_time"] == "MORNING" else 1, c["defense_room"]))

        return {
            "success": True,
            "total_councils": len(councils),
            "scheduled_projects_count": total_projects,
            "scheduled_slots_count": total_projects,
            "councils": council_schedules,
            "slots": scheduled_slots
        }
