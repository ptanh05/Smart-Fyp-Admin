import datetime
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from app.models import (
    CustomUser,
    AuditLog,
    Department,
    AcademicBatch,
    CourseClass,
    ProjectTopicArea,
    Student,
    Supervisor,
    SupervisorQuota,
    StudentPreference,
    DefenseCouncil,
    CouncilMember,
    GraduationProject,
    DefenseScheduleSlot
)

class Command(BaseCommand):
    help = "Seed realistic sample data for SMART FYP UTC Admin Portal (Users, Batches, Supervisors, Students, Councils)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Wipe existing sample data before seeding',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE(">>> Starting SMART FYP UTC Admin Data Seeding..."))

        from app.utils.db_helpers import fix_all_postgres_sequences
        self.stdout.write(self.style.NOTICE(">>> Synchronizing PostgreSQL sequences before seeding..."))
        fix_all_postgres_sequences()

        if options.get('reset'):
            self.stdout.write(self.style.WARNING("Reset flag provided. Cleaning existing business data..."))
            GraduationProject.objects.all().delete()
            DefenseCouncil.objects.all().delete()
            StudentPreference.objects.all().delete()
            SupervisorQuota.objects.all().delete()
            Student.objects.all().delete()
            # CHỈ xóa hồ sơ GV demo (không phải GV chính thức UTC001..UTC033).
            # Xóa toàn bộ Supervisor.objects.all() sẽ xóa luôn danh sách giảng
            # viên chính thức trong DB dùng chung và không thể nạp lại từ repo
            # admin (lệnh seed_official_supervisors nằm ở repo smart-fyp-management).
            demo_supervisor_usernames = [
                "gv_nguyenvana", "gv_tranthib", "gv_levanc",
                "gv_phamminhd", "gv_hoangvanh",
            ]
            demo_sup_ids = list(
                Supervisor.objects.filter(
                    user__username__in=demo_supervisor_usernames
                ).values_list("id", flat=True)
            )
            if demo_sup_ids:
                Supervisor.objects.filter(id__in=demo_sup_ids).delete()
            # Giữ lại các hồ sơ GV chính thức (supervisor_id bắt đầu bằng "UTC").
            Supervisor.objects.exclude(supervisor_id__startswith="UTC").delete()
            CourseClass.objects.all().delete()
            AcademicBatch.objects.all().delete()
            Department.objects.all().delete()
            ProjectTopicArea.objects.all().delete()
            # Do not delete superusers if any exist.
            # Cũng KHÔNG xóa user của giảng viên chính thức (UTC001..UTC033):
            # xóa user sẽ cascade sang Supervisor -> GraduationProject -> mất dữ liệu.
            official_sup_user_ids = list(
                Supervisor.objects.filter(
                    supervisor_id__startswith="UTC"
                ).values_list("user_id", flat=True)
            )
            CustomUser.objects.filter(
                is_superuser=False,
                user_type__in=["student", "committee_member", "external_examiner"],
            ).delete()
            CustomUser.objects.filter(
                is_superuser=False,
                user_type="supervisor",
            ).exclude(id__in=official_sup_user_ids).delete()

        with transaction.atomic():
            # 1. Admin & Superuser Accounts
            admins_data = [
                {
                    "username": "admin",
                    "email": "admin@utc.edu.vn",
                    "first_name": "Quản Trị",
                    "last_name": "Hệ Thống",
                    "user_type": "admin",
                    "is_staff": True,
                    "is_superuser": True,
                },
                {
                    "username": "anh018031",
                    "email": "anh018031@gmail.com",
                    "first_name": "Thế Anh",
                    "last_name": "Phùng",
                    "user_type": "admin",
                    "is_staff": True,
                    "is_superuser": True,
                }
            ]

            created_admins = 0
            for adm in admins_data:
                user, created = CustomUser.objects.get_or_create(
                    username=adm["username"],
                    defaults={
                        "email": adm["email"],
                        "first_name": adm["first_name"],
                        "last_name": adm["last_name"],
                        "user_type": adm["user_type"],
                        "is_staff": adm["is_staff"],
                        "is_superuser": adm["is_superuser"],
                        "is_active": True,
                    }
                )
                if created:
                    user.set_password("admin123")
                    user.save()
                    created_admins += 1
                else:
                    # Ensure user has admin privileges
                    updated = False
                    if user.user_type != "admin":
                        user.user_type = "admin"
                        updated = True
                    if not user.is_staff or not user.is_superuser:
                        user.is_staff = True
                        user.is_superuser = True
                        updated = True
                    if updated:
                        user.save()

            self.stdout.write(self.style.SUCCESS(f"  [+] Admin accounts verified (admin, anh018031). Password: 'admin123'"))

            # 2. Departments (Bộ môn chuyên môn UTC)
            departments_data = [
                {"code": "CNPM", "name": "Bộ môn Công nghệ Phần mềm", "desc": "Khoa CNTT - ĐH Giao thông Vận tải"},
                {"code": "KHMT", "name": "Bộ môn Khoa học Máy tính", "desc": "Khoa CNTT - ĐH Giao thông Vận tải"},
                {"code": "HTTT", "name": "Bộ môn Hệ thống Thông tin", "desc": "Khoa CNTT - ĐH Giao thông Vận tải"},
                {"code": "MMT", "name": "Bộ môn Mạng máy tính & Viễn thông", "desc": "Khoa CNTT - ĐH Giao thông Vận tải"},
            ]
            dep_map = {}
            for d in departments_data:
                dep_obj, _ = Department.objects.get_or_create(
                    code=d["code"],
                    defaults={"name": d["name"], "description": d["desc"]}
                )
                dep_map[d["code"]] = dep_obj

            self.stdout.write(self.style.SUCCESS(f"  [+] Departments ready: {len(dep_map)} departments"))

            # 3. Academic Batches (Đợt đồ án tốt nghiệp UTC)
            batch1, _ = AcademicBatch.objects.get_or_create(
                batch_code="K62_CNTT_2026",
                defaults={
                    "batch_name": "Đợt 1 - Khóa 62 CNTT Đại trà & CLC (2025 - 2026)",
                    "program_type": "BACHELOR",
                    "current_stage": "PHASE_3_TOPIC",
                    "start_date": timezone.now().date() - datetime.timedelta(days=60),
                    "end_date": timezone.now().date() + datetime.timedelta(days=120),
                    "is_active": True,
                    "is_allocation_published": True,
                }
            )

            batch2, _ = AcademicBatch.objects.get_or_create(
                batch_code="K62_ENG_2026",
                defaults={
                    "batch_name": "Đợt 2 - Khóa 62 Kỹ sư CNTT (2025 - 2026)",
                    "program_type": "ENGINEER",
                    "current_stage": "PHASE_1_SETUP",
                    "start_date": timezone.now().date() - datetime.timedelta(days=15),
                    "end_date": timezone.now().date() + datetime.timedelta(days=150),
                    "is_active": True,
                    "is_allocation_published": False,
                }
            )

            # 4. Course Classes (Lớp học phần)
            classes_data = [
                {"code": "CNTT1_K62", "name": "Lớp CNTT 1 - K62", "prog": "DAI_TRA", "edu": "BACHELOR", "batch": batch1},
                {"code": "CNTT2_K62", "name": "Lớp CNTT 2 - K62", "prog": "DAI_TRA", "edu": "BACHELOR", "batch": batch1},
                {"code": "CNTT_VA_K62", "name": "Lớp CNTT Việt - Anh - K62", "prog": "VIET_ANH", "edu": "BACHELOR", "batch": batch1},
                {"code": "KHMT1_K62", "name": "Lớp KHMT 1 - K62", "prog": "KHMT", "edu": "BACHELOR", "batch": batch1},
            ]
            class_map = {}
            for c in classes_data:
                c_obj, _ = CourseClass.objects.get_or_create(
                    batch=c["batch"],
                    class_code=c["code"],
                    defaults={
                        "class_name": c["name"],
                        "program_type": c["prog"],
                        "education_program": c["edu"],
                        "class_group": "N01"
                    }
                )
                class_map[c["code"]] = c_obj

            # 5. Project Topic Areas (Hướng đề tài nghiên cứu)
            topic_areas_data = [
                {"code": "AI_ML", "name": "Trí tuệ nhân tạo & Học máy (AI/ML)"},
                {"code": "WEB_CLOUD", "name": "Phát triển Web & Điện toán đám mây"},
                {"code": "IOT_EMBED", "name": "Internet vạn vật (IoT) & Hệ thống nhúng"},
                {"code": "MOBILE_APP", "name": "Ứng dụng Di động Đa nền tảng"},
                {"code": "SECURITY_CHAIN", "name": "An toàn thông tin & Blockchain"},
            ]
            area_map = {}
            for a in topic_areas_data:
                area_obj, _ = ProjectTopicArea.objects.get_or_create(
                    code=a["code"],
                    defaults={"name": a["name"], "is_active": True}
                )
                area_map[a["code"]] = area_obj

            # 6. Supervisors (Giảng viên hướng dẫn UTC)
            # ------------------------------------------------------------------
            # KHÔNG seed tài khoản giảng viên DEMO nữa (gv_nguyenvana, gv_tranthib,
            # gv_levanc, gv_phamminhd, gv_hoangvanh). Những tài khoản đó đã bị
            # gỡ khỏi DB dùng chung và trùng lặp với danh sách giảng viên chính
            # thức (UTC001..UTC033) được nạp bởi
            #   smart-fyp-management/app/management/commands/seed_official_supervisors.py
            # Lệnh này chỉ TÌM các giảng viên chính thức đã tồn tại trong DB
            # dùng chung và tái sử dụng chúng. Nếu chưa có thì bỏ qua (không tạo
            # tài khoản giả), để mỗi lần deploy trên Render không tái sinh demo.
            official_supervisor_usernames = [
                "gv_tran_thi_ngan",      # UTC001 - PGS.TS. Trần Thị Ngân
                "gv_nguyen_van_long",    # UTC002 - PGS.TS. Nguyễn Văn Long
                "gv_bui_ngoc_dung",      # UTC003 - TS. Bùi Ngọc Dũng
                "gv_cao_thi_luyen",      # UTC004 - TS. Cao Thị Luyên
                "gv_ao_thi_le_thuy",     # UTC005 - TS. Đào Thị Lệ Thủy
            ]

            spv_map = {}
            missing_official = []
            for sup_username in official_supervisor_usernames:
                spv_user = CustomUser.objects.filter(username=sup_username).first()
                if spv_user is None:
                    missing_official.append(sup_username)
                    continue
                spv_profile = Supervisor.objects.filter(user=spv_user).first()
                if spv_profile is None:
                    missing_official.append(sup_username)
                    continue
                spv_map[sup_username] = spv_profile

                # SupervisorQuota cho Batch 1 (get_or_create => idempotent)
                quota_obj, _ = SupervisorQuota.objects.get_or_create(
                    supervisor=spv_profile,
                    batch=batch1,
                    defaults={
                        "base_quota": 5,
                        "rank_multiplier": spv_profile.academic_rank_multiplier or 1.0,
                        "max_total_quota": int(round(5 * (spv_profile.academic_rank_multiplier or 1.0))),
                        "viet_anh_quota": 2,
                        "general_cntt_quota": int(round(5 * (spv_profile.academic_rank_multiplier or 1.0))) - 2,
                        "current_assigned": 0
                    }
                )

            if missing_official:
                self.stdout.write(
                    self.style.WARNING(
                        "  ! Bỏ qua %d giảng viên chính thức chưa có trong DB: %s. "
                        "Hãy chạy `python manage.py seed_official_supervisors` ở backend "
                        "smart-fyp-management trước."
                        % (len(missing_official), ", ".join(missing_official))
                    )
                )

            # 7. External Examiners / Council Members
            external_users_data = [
                {
                    "username": "cb_nguyenvanx",
                    "email": "xuan.nv@ptit.edu.vn",
                    "first_name": "Văn Xuân",
                    "last_name": "TS. Nguyễn",
                    "user_type": "external_examiner",
                    "inst": "Học viện Công nghệ Bưu chính Viễn thông"
                },
                {
                    "username": "cb_dangthiy",
                    "email": "yen.dt@hust.edu.vn",
                    "first_name": "Thị Yến",
                    "last_name": "TS. Đặng",
                    "user_type": "external_examiner",
                    "inst": "Đại học Bách Khoa Hà Nội"
                }
            ]
            for ext in external_users_data:
                ext_user, _ = CustomUser.objects.get_or_create(
                    username=ext["username"],
                    defaults={
                        "email": ext["email"],
                        "first_name": ext["first_name"],
                        "last_name": ext["last_name"],
                        "user_type": ext["user_type"],
                        "is_active": True,
                    }
                )
                if not ext_user.has_usable_password():
                    ext_user.set_password("cb123456")
                    ext_user.save()

            self.stdout.write(self.style.SUCCESS(f"  [+] Supervisors and Examiners ready: {len(spv_map) + len(external_users_data)} accounts"))

            # 8. Students (Sinh viên) - matching exactly the user's screenshot + test scenarios
            students_data = [
                # 4 exact students from screenshot
                {
                    "mssv": "201200101",
                    "first_name": "An",
                    "last_name": "Nguyễn Văn",
                    "email": "201200101@lms.utc.edu.vn",
                    "phone": "0912345671",
                    "class_code": "CNTT1_K62",
                    "edu": "BACHELOR",
                    "spv_username": "gv_tran_thi_ngan",
                    "topic_title": "Xây dựng hệ thống quản lý đồ án tốt nghiệp thông minh Smart FYP ứng dụng React và Django REST",
                    "status": "IN_PROGRESS",
                    "review_status": "APPROVED",
                    "eligibility": "ELIGIBLE",
                    "gpa": 3.42,
                    "debt_credits": 0,
                },
                {
                    "mssv": "201200102",
                    "first_name": "Bình",
                    "last_name": "Trần Thị",
                    "email": "201200102@lms.utc.edu.vn",
                    "phone": "0912345672",
                    "class_code": "CNTT_VA_K62",
                    "edu": "BACHELOR",
                    "spv_username": "gv_nguyen_van_long",
                    "topic_title": "Nghiên cứu mô hình nhận diện khuôn mặt điểm danh sinh viên bằng Deep Learning và Vision Transformer",
                    "status": "IN_PROGRESS",
                    "review_status": "APPROVED",
                    "eligibility": "ELIGIBLE",
                    "gpa": 3.55,
                    "debt_credits": 0,
                },
                {
                    "mssv": "201200103",
                    "first_name": "Cường",
                    "last_name": "Lê Hoàng",
                    "email": "201200103@lms.utc.edu.vn",
                    "phone": "0912345673",
                    "class_code": "KHMT1_K62",
                    "edu": "BACHELOR",
                    "spv_username": None, # Test: Chưa phân GVHD
                    "topic_title": "",
                    "status": "ALLOCATED",
                    "review_status": "DRAFT",
                    "eligibility": "PENDING",
                    "gpa": 3.10,
                    "debt_credits": 0,
                },
                {
                    "mssv": "201200104",
                    "first_name": "Đức",
                    "last_name": "Phạm Minh",
                    "email": "201200104@lms.utc.edu.vn",
                    "phone": "0912345674",
                    "class_code": "CNTT2_K62",
                    "edu": "BACHELOR",
                    "spv_username": None, # Test: Chưa phân GVHD
                    "topic_title": "",
                    "status": "ALLOCATED",
                    "review_status": "DRAFT",
                    "eligibility": "PENDING",
                    "gpa": 2.85,
                    "debt_credits": 2,
                },
                # Additional students for rich phase testing
                {
                    "mssv": "201200105",
                    "first_name": "Dung",
                    "last_name": "Hoàng Thị",
                    "email": "201200105@lms.utc.edu.vn",
                    "phone": "0912345675",
                    "class_code": "CNTT1_K62",
                    "edu": "BACHELOR",
                    "spv_username": "gv_bui_ngoc_dung",
                    "topic_title": "Xây dựng ứng dụng đặt lịch khám và quản lý hồ sơ y tế phòng khám thông minh trên nền tảng Flutter",
                    "status": "IN_PROGRESS",
                    "review_status": "APPROVED",
                    "eligibility": "ELIGIBLE",
                    "gpa": 3.68,
                    "debt_credits": 0,
                },
                {
                    "mssv": "201200106",
                    "first_name": "Giang",
                    "last_name": "Vũ Đình",
                    "email": "201200106@lms.utc.edu.vn",
                    "phone": "0912345676",
                    "class_code": "CNTT2_K62",
                    "edu": "BACHELOR",
                    "spv_username": "gv_cao_thi_luyen",
                    "topic_title": "Phát triển hệ thống IoT giám sát chất lượng không khí đô thị và cảnh báo tự động",
                    "status": "ALLOCATED",
                    "review_status": "DRAFT",
                    "eligibility": "INELIGIBLE", # Test GĐ4 Force Approve
                    "gpa": 1.78,
                    "debt_credits": 12,
                },
                {
                    "mssv": "201200107",
                    "first_name": "Hải",
                    "last_name": "Đỗ Minh",
                    "email": "201200107@lms.utc.edu.vn",
                    "phone": "0912345677",
                    "class_code": "KHMT1_K62",
                    "edu": "BACHELOR",
                    "spv_username": "gv_ao_thi_le_thuy",
                    "topic_title": "Nghiên cứu ứng dụng Blockchain trong xác thực bằng tốt nghiệp và chứng chỉ trực tuyến",
                    "status": "DEFENSE_READY", # Test GĐ6 Hội đồng bảo vệ
                    "review_status": "APPROVED",
                    "eligibility": "ELIGIBLE",
                    "gpa": 3.75,
                    "debt_credits": 0,
                },
                {
                    "mssv": "201200108",
                    "first_name": "Linh",
                    "last_name": "Bùi Thảo",
                    "email": "201200108@lms.utc.edu.vn",
                    "phone": "0912345678",
                    "class_code": "CNTT_VA_K62",
                    "edu": "BACHELOR",
                    "spv_username": None, # Test GĐ2 Thuật toán phân công theo nguyện vọng
                    "topic_title": "",
                    "status": "ALLOCATED",
                    "review_status": "DRAFT",
                    "eligibility": "PENDING",
                    "gpa": 3.25,
                    "debt_credits": 0,
                },
            ]

            created_students = 0
            for s_data in students_data:
                # `registration_no` là UNIQUE trên `app_student`. Trước đây lệnh seed
                # luôn tạo user mới theo MSSV, nên nếu MSSV đã tồn tại (do backend
                # smart-fyp-management hoặc lần seed trước tạo với user khác) thì
                # sẽ vi phạm unique constraint và làm build trên Render fail.
                # -> Tái sử dụng profile hiện có nếu MSSV đã tồn tại.
                existing_profile = (
                    Student.objects.filter(registration_no=s_data["mssv"])
                    .select_related("user")
                    .first()
                )

                if existing_profile is not None:
                    u = existing_profile.user
                    std_profile = existing_profile
                else:
                    u, _ = CustomUser.objects.get_or_create(
                        username=s_data["mssv"],
                        defaults={
                            "email": s_data["email"],
                            "first_name": s_data["first_name"],
                            "last_name": s_data["last_name"],
                            "user_type": "student",
                            "is_active": True,
                        }
                    )
                    if not u.has_usable_password():
                        u.set_password(s_data["mssv"]) # Mặc định pass = MSSV
                        u.save()

                    c_obj = class_map.get(s_data["class_code"])
                    std_profile, _ = Student.objects.get_or_create(
                        user=u,
                        defaults={
                            "registration_no": s_data["mssv"],
                            "department": c_obj.class_name if c_obj else "CNTT",
                            "education_program": s_data["edu"],
                            "course_class": c_obj,
                            "academic_batch": batch1,
                            "phone_number": s_data["phone"]
                        }
                    )
                created_students += 1

                # If student has preference (for GĐ2 testing)
                if not s_data["spv_username"]:
                    StudentPreference.objects.get_or_create(
                        student=std_profile,
                        batch=batch1,
                        defaults={
                            "topic_direction": area_map.get("AI_ML"),
                            "preference_1": spv_map.get("gv_nguyen_van_long"),
                            "preference_2": spv_map.get("gv_tran_thi_ngan"),
                            "preference_3": spv_map.get("gv_bui_ngoc_dung"),
                            "sub_criteria": "Ưu tiên đề tài liên quan đến Trí tuệ nhân tạo hoặc Web"
                        }
                    )

                # If student is assigned to supervisor, create GraduationProject
                if s_data["spv_username"] and spv_map.get(s_data["spv_username"]):
                    spv_obj = spv_map[s_data["spv_username"]]
                    proj, _ = GraduationProject.objects.get_or_create(
                        student=std_profile,
                        defaults={
                            "supervisor": spv_obj,
                            "batch": batch1,
                            "topic_category": area_map.get("WEB_CLOUD"),
                            "topic_title_vi": s_data["topic_title"] or "Đề tài tốt nghiệp CNTT K62",
                            "topic_title_en": "Graduation Thesis Project K62 UTC",
                            "status": s_data["status"],
                            "topic_review_status": s_data["review_status"],
                            "initial_eligibility": s_data["eligibility"],
                            "gpa_score": s_data["gpa"],
                            "debt_credits": s_data["debt_credits"],
                            "supervisor_defense_confirmed": (s_data["status"] == "DEFENSE_READY"),
                            "final_academic_eligibility": "ELIGIBLE" if s_data["status"] == "DEFENSE_READY" else "PENDING",
                        }
                    )

            self.stdout.write(self.style.SUCCESS(f"  [+] Students seeded: {created_students} students (Phase 1 to Phase 6 test scenarios)"))

            # 9. Update current_assigned on SupervisorQuota
            for spv_username, spv_obj in spv_map.items():
                assigned_count = GraduationProject.objects.filter(supervisor=spv_obj, batch=batch1).count()
                SupervisorQuota.objects.filter(supervisor=spv_obj, batch=batch1).update(current_assigned=assigned_count)

            # 10. Defense Council (Hội đồng bảo vệ chuẩn UTC)
            council, _ = DefenseCouncil.objects.get_or_create(
                batch=batch1,
                council_number=1,
                defaults={
                    "council_name": "Hội đồng Đồ án CNTT 01 - K62 (CNPM & AI)",
                    "session_date": timezone.now().date() + datetime.timedelta(days=30),
                    "session_time": "MORNING",
                    "defense_room": "P.302 - Nhà A9 (Trụ sở chính UTC)",
                    "is_finalized": False
                }
            )

            # Members: 1 Chủ tịch, 2 Thư ký, 2 Ủy viên (Mô hình 5 thành viên UTC)
            council_roles = [
                {"spv_user": "gv_tran_thi_ngan", "role": "CHAIR", "ext": None},
                {"spv_user": "gv_nguyen_van_long", "role": "SECRETARY", "ext": None},
                {"spv_user": "gv_bui_ngoc_dung", "role": "SECRETARY", "ext": None},
                {"spv_user": "gv_cao_thi_luyen", "role": "MEMBER", "ext": None},
                {"spv_user": "cb_nguyenvanx", "role": "EXTERNAL_MEMBER", "ext": "Học viện CNBC Viễn thông"},
            ]
            for cr in council_roles:
                u_obj = CustomUser.objects.filter(username=cr["spv_user"]).first()
                if u_obj:
                    spv_p = getattr(u_obj, "admin_supervisor_profile", None)
                    cm, created = CouncilMember.objects.get_or_create(
                        council=council,
                        user=u_obj,
                        defaults={
                            "supervisor": spv_p,
                            "role": cr["role"],
                            "external_institution": cr["ext"]
                        }
                    )
                    # Giữ vai trò nhất quán với danh sách khai báo ở trên (idempotent).
                    changed = False
                    if cm.role != cr["role"]:
                        cm.role = cr["role"]
                        changed = True
                    if cm.supervisor_id != (spv_p.id if spv_p else None):
                        cm.supervisor = spv_p
                        changed = True
                    if cm.external_institution != (cr["ext"] or ""):
                        cm.external_institution = cr["ext"] or ""
                        changed = True
                    if changed:
                        cm.save(update_fields=["role", "supervisor", "external_institution"])

            # Assign ready student to this council
            ready_proj = GraduationProject.objects.filter(status="DEFENSE_READY").first()
            if ready_proj:
                ready_proj.council = council
                ready_proj.reviewer = spv_map.get("gv_nguyen_van_long")
                ready_proj.save(update_fields=["council", "reviewer"])

                DefenseScheduleSlot.objects.get_or_create(
                    council=council,
                    project=ready_proj,
                    defaults={
                        "order_number": 1,
                        "slot_date": council.session_date,
                        "start_time": datetime.time(8, 0),
                        "end_time": datetime.time(8, 45),
                        "room": council.defense_room,
                    }
                )

            self.stdout.write(self.style.SUCCESS(f"  [+] Defense Council ready: Hoi dong 01 (5 council members)"))

            # 11. Initial Audit Log
            admin_user = CustomUser.objects.filter(user_type="admin").first()
            AuditLog.objects.get_or_create(
                action_type="admin_user_update",
                description="Hệ thống tự động khởi tạo bộ dữ liệu mẫu UTC (Seeding Demo Data) thành công.",
                defaults={
                    "user": admin_user,
                    "field_name": "SYSTEM_SEED",
                    "old_value": "EMPTY",
                    "new_value": "DEMO_DATA_POPULATED"
                }
            )

        # Synchronize all PostgreSQL sequences after populating all tables
        fix_all_postgres_sequences()
        self.stdout.write(self.style.SUCCESS(">>> [COMPLETE] SMART FYP UTC Admin Data Seeded Successfully!"))
