import os
import django
import sys

# Set encoding
if sys.platform.startswith("win"):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from app.models import (
    CustomUser,
    Department,
    AcademicBatch,
    CourseClass,
    Student,
    Supervisor,
    SupervisorQuota,
    ProjectTopicArea,
    StudentPreference,
    InternshipInfo,
    GraduationProject,
    OutlineReviewGroup,
    OutlineReview,
    SupervisionMeetingLog,
    SupervisionTask,
    WeeklyProgressReport,
    DefenseCouncil,
    CouncilMember,
    DefenseScheduleSlot,
    CouncilLiveScore,
    EvaluationPolicy,
    FinalGradeSummary,
    AuditLog,
    Notification
)


def seed_database():
    print("================================================================================")
    print("[START] SEED DU LIEU CHUAN UTC (25 BANG PURE UTC SCHEMA) LEN NEON POSTGRESQL")
    print("================================================================================")

    # 1. Admin Superuser
    admin_user, created = CustomUser.objects.get_or_create(
        username="admin",
        defaults={
            "email": "admin@utc.edu.vn",
            "first_name": "Quan Tri",
            "last_name": "Khoa CNTT",
            "user_type": "admin",
            "is_staff": True,
            "is_superuser": True,
        }
    )
    admin_user.set_password("Admin@123456")
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.save()
    print(f"[OK] [1/9] Admin User: {admin_user.username} (Password: Admin@123456)")

    # 2. Departments
    dept_cnpm, _ = Department.objects.get_or_create(
        code="CNPM",
        defaults={"name": "Bo mon Cong nghe phan mem", "description": "Khoa CNTT - UTC"}
    )
    dept_httt, _ = Department.objects.get_or_create(
        code="HTTT",
        defaults={"name": "Bo mon He thong thong tin", "description": "Khoa CNTT - UTC"}
    )
    dept_khmt, _ = Department.objects.get_or_create(
        code="KHMT",
        defaults={"name": "Bo mon Khoa hoc may tinh va Mang may tinh", "description": "Khoa CNTT - UTC"}
    )
    print(f"[OK] [2/9] Bo mon: {dept_cnpm.code}, {dept_httt.code}, {dept_khmt.code}")

    # 3. Academic Batch K62
    batch, _ = AcademicBatch.objects.get_or_create(
        batch_code="K62_HK1_2026_2027",
        defaults={
            "batch_name": "Dot Do an Tot nghiep K62 - Hoc ky 1 (2026-2027)",
            "program_type": "BOTH",
            "current_stage": "PHASE_1_SETUP",
            "is_active": True,
            "is_allocation_published": False,
            "is_closed": False,
        }
    )
    print(f"[OK] [3/9] Dot Do an: {batch.batch_code} - {batch.batch_name}")

    # 4. Evaluation Policy
    policy, _ = EvaluationPolicy.objects.get_or_create(
        batch=batch,
        defaults={
            "weight_supervisor": 0.4,
            "weight_reviewer": 0.2,
            "weight_council": 0.4
        }
    )
    print(f"[OK] [4/9] Quy che diem: GVHD {int(policy.weight_supervisor*100)}% - GVPB {int(policy.weight_reviewer*100)}% - HD {int(policy.weight_council*100)}%")

    # 5. Project Topic Areas
    topics_data = [
        ("AI_ML", "Tri tue nhan tao & Hoc may", "Nghien cuu mo hinh LLM, thi giac may tinh, nhan dang"),
        ("WEB_MOBILE", "Phat trien Web & Mobile nang cao", "He thong kien truc Microservices, React, Flutter"),
        ("CYBER_SEC", "An toan thong tin & Mang", "Phat hien tan cong, bao mat dam may, cryptography"),
        ("DATA_SCI", "Khoa hoc Du lieu & Phan tich lon", "Big Data, du bao kinh te so, Data Pipeline"),
        ("IOT_EMBED", "Internet van vat & He thong nhung", "Smart City, cam bien thoi gian thuc"),
    ]
    topic_objs = {}
    for code, name, desc in topics_data:
        obj, _ = ProjectTopicArea.objects.get_or_create(
            code=code,
            defaults={"name": name, "description": desc, "is_active": True}
        )
        topic_objs[code] = obj
    print(f"[OK] [5/9] Linh vuc nghien cuu: {len(topic_objs)} linh vuc san sang")

    # 6. Supervisors (3 TS/PGS, 2 ThS)
    supervisors_data = [
        ("ts_thang", "Vu Ba", "Thang", "thangvb@utc.edu.vn", "GV001", "TS", dept_cnpm, 1.2, 6),
        ("pgs_ha", "Do Thi", "Ha", "hadt@utc.edu.vn", "GV002", "PGS.TS", dept_httt, 1.5, 8),
        ("ts_nam", "Tran Hoai", "Nam", "namth@utc.edu.vn", "GV003", "TS", dept_khmt, 1.2, 6),
        ("ths_linh", "Nguyen Thuy", "Linh", "linhnt@utc.edu.vn", "GV004", "ThS", dept_cnpm, 1.0, 5),
        ("ths_duc", "Le Minh", "Duc", "duclm@utc.edu.vn", "GV005", "ThS", dept_httt, 1.0, 5),
    ]
    supervisor_objs = []
    for uname, fname, lname, email, gid, title, dept, mult, base_quota in supervisors_data:
        u, _ = CustomUser.objects.get_or_create(
            username=uname,
            defaults={
                "email": email,
                "first_name": fname,
                "last_name": lname,
                "user_type": "supervisor",
            }
        )
        u.set_password("Gv@123456")
        u.save()

        sup, _ = Supervisor.objects.get_or_create(
            user=u,
            defaults={
                "supervisor_id": gid,
                "academic_title": title,
                "department_name": dept.name,
                "department_obj": dept,
                "academic_rank_multiplier": mult,
                "research_interest": "Cong nghe thong tin ung dung",
                "phone_number": "0912345678",
                "is_external": False
            }
        )
        supervisor_objs.append(sup)

        # Quota
        quota, _ = SupervisorQuota.objects.get_or_create(
            supervisor=sup,
            batch=batch,
            defaults={
                "department": dept.code,
                "base_quota": base_quota,
                "rank_multiplier": mult,
                "max_total_quota": int(round(base_quota * mult)),
                "current_assigned": 0
            }
        )
    print(f"[OK] [6/9] Giang vien & Han muc Quota: {len(supervisor_objs)} GV san sang")

    # 7. Course Classes
    class_cn = CourseClass.objects.filter(batch=batch, class_code="CNTT1-K62").first()
    if not class_cn:
        class_cn = CourseClass.objects.create(
            batch=batch,
            class_code="CNTT1-K62",
            class_name="Cong nghe Thong tin 1 K62",
            program_type="DAI_TRA",
            education_program="BACHELOR"
        )

    class_ks = CourseClass.objects.filter(batch=batch, class_code="KSCNTT-K62").first()
    if not class_ks:
        class_ks = CourseClass.objects.create(
            batch=batch,
            class_code="KSCNTT-K62",
            class_name="Ky su Cong nghe Thong tin K62",
            program_type="KHMT",
            education_program="ENGINEER"
        )
    print(f"[OK] [7/9] Lop hoc phan: {class_cn.class_code} (Cu nhan), {class_ks.class_code} (Ky su)")

    # 8. Students (10 sinh vien)
    students_data = [
        ("sv_an", "Nguyen Van", "An", "an.nv@utc.edu.vn", "201200001", "BACHELOR", class_cn),
        ("sv_binh", "Tran Thi", "Binh", "binh.tt@utc.edu.vn", "201200002", "BACHELOR", class_cn),
        ("sv_chi", "Le Khanh", "Chi", "chi.lk@utc.edu.vn", "201200003", "BACHELOR", class_cn),
        ("sv_dung", "Pham Quoc", "Dung", "dung.pq@utc.edu.vn", "201200004", "BACHELOR", class_cn),
        ("sv_em", "Hoang Kim", "Em", "em.hk@utc.edu.vn", "201200005", "BACHELOR", class_cn),
        ("sv_giang", "Dinh Truong", "Giang", "giang.dt@utc.edu.vn", "201200006", "BACHELOR", class_cn),
        ("sv_hung", "Vu Manh", "Hung", "hung.vm@utc.edu.vn", "201200007", "ENGINEER", class_ks),
        ("sv_khanh", "Bui Nam", "Khanh", "khanh.bn@utc.edu.vn", "201200008", "ENGINEER", class_ks),
        ("sv_long", "Do Hoang", "Long", "long.dh@utc.edu.vn", "201200009", "ENGINEER", class_ks),
        ("sv_minh", "Ngo Nhat", "Minh", "minh.nn@utc.edu.vn", "201200010", "ENGINEER", class_ks),
    ]

    topic_keys = list(topic_objs.keys())
    for idx, (uname, fname, lname, email, msv, edu, cclass) in enumerate(students_data):
        su, _ = CustomUser.objects.get_or_create(
            username=uname,
            defaults={
                "email": email,
                "first_name": fname,
                "last_name": lname,
                "user_type": "student",
            }
        )
        su.set_password("Sv@123456")
        su.save()

        st, _ = Student.objects.get_or_create(
            user=su,
            defaults={
                "registration_no": msv,
                "department": "CNTT",
                "semester": "Hoc ky 1 (2026-2027)",
                "batch_no": "K62",
                "phone_number": f"09876543{idx:02d}",
                "education_program": edu,
                "course_class": cclass,
                "academic_batch": batch
            }
        )

        # Student Preference
        topic_choice = topic_objs[topic_keys[idx % len(topic_keys)]]
        sup1 = supervisor_objs[idx % len(supervisor_objs)]
        sup2 = supervisor_objs[(idx + 1) % len(supervisor_objs)]
        sup3 = supervisor_objs[(idx + 2) % len(supervisor_objs)]

        StudentPreference.objects.get_or_create(
            student=st,
            defaults={
                "batch": batch,
                "topic_direction": topic_choice,
                "preference_1": sup1,
                "preference_2": sup2,
                "preference_3": sup3,
                "sub_criteria": "Uu tien de tai co kha nang ung dung thuc tien cao"
            }
        )

        # Internship Info
        InternshipInfo.objects.get_or_create(
            student=st,
            defaults={
                "batch": batch,
                "is_interning": (idx % 2 == 0),
                "company_name": "Tap doan Viettel" if (idx % 2 == 0) else "",
                "topic_direction": topic_choice,
                "tentative_title": f"Nghien cuu ung dung {topic_choice.name} vao chuyen doi so doanh nghiep"
            }
        )
    print(f"[OK] [8/9] Sinh vien & Nguyen vong: Da tao 10 Sinh vien (6 Cu nhan + 4 Ky su)")

    # 9. Defense Council (Hoi dong bao ve chuan UTC: 1 Chu tich, 2 Thu ky, 2 Uy vien)
    council, _ = DefenseCouncil.objects.get_or_create(
        batch=batch,
        council_number=1,
        defaults={
            "council_name": "Hoi dong Bao ve DATN K62 - Hoi dong 01",
            "session_time": "MORNING",
            "defense_room": "P.402-A9",
            "is_finalized": False
        }
    )

    # Council Members
    roles_setup = [
        (supervisor_objs[1], "CHAIR"),       # PGS.TS Do Thi Ha - Chu tich
        (supervisor_objs[3], "SECRETARY"),   # ThS Nguyen Thuy Linh - Thu ky 1
        (supervisor_objs[4], "SECRETARY"),   # ThS Le Minh Duc - Thu ky 2
        (supervisor_objs[0], "MEMBER"),      # TS Vu Ba Thang - Uy vien
        (supervisor_objs[2], "MEMBER"),      # TS Tran Hoai Nam - Uy vien
    ]
    for s_obj, role_name in roles_setup:
        CouncilMember.objects.get_or_create(
            council=council,
            user=s_obj.user,
            defaults={
                "supervisor": s_obj,
                "role": role_name
            }
        )

    # Validate UTC formula
    check_res = council.check_utc_model_validity()
    print(f"[OK] [9/9] Hoi dong bao ve: {council.council_name}")
    print(f"   -> Kiem tra co cau UTC: {check_res['is_valid']} ({check_res['expected_formula']})")

    # Audit log
    AuditLog.objects.create(
        user=admin_user,
        action_type="SYSTEM_SEED",
        description="Khoi tao co so du lieu mau chuan UTC (25 Bang Pure UTC Schema) thanh cong."
    )

    print("================================================================================")
    print("[SUCCESS] SEED DU LIEU THANH CONG 100%! HE THONG SAN SANG.")
    print("================================================================================")


if __name__ == "__main__":
    seed_database()
