import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
import io
import re
import random
import string
from django.db import transaction
from app.models import (
    CustomUser,
    Student,
    Supervisor,
    SupervisorQuota,
    AcademicBatch,
    CourseClass,
    GraduationProject,
    AuditLog
)

def generate_random_password(length=8):
    chars = string.ascii_letters + string.digits + "!@#"
    return "".join(random.choice(chars) for _ in range(length))

class ExcelImportService:
    @staticmethod
    def import_students_from_excel(
        file_obj,
        batch_id,
        password_strategy="MSSV",
        custom_fixed_password="",
        default_major="CNTT"
    ):
        """
        Import sinh viên và phân loại lớp học phần, chương trình đào tạo (Cử nhân / Kỹ sư).
        """
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {
                "success": False,
                "error": f"Không tìm thấy đợt ID {batch_id}.",
                "total": 0,
                "created": 0,
                "updated": 0,
                "skipped": 0,
                "errors": [],
                "created_accounts": []
            }

        try:
            wb = openpyxl.load_workbook(file_obj, data_only=True)
        except Exception as ex:
            return {
                "success": False,
                "error": f"Không thể đọc file Excel: {str(ex)}",
                "total": 0,
                "created": 0,
                "updated": 0,
                "skipped": 0,
                "errors": [str(ex)],
                "created_accounts": []
            }

        total_count = 0
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        created_accounts = []

        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            if ws.max_row < 2:
                continue

            class_code = sheet_name.strip()
            class_name = f"Lớp {class_code}"
            class_group = ""
            program_type = "DAI_TRA"
            if default_major == "KHMT":
                program_type = "KHMT"

            education_program = "ENGINEER" if batch.program_type == "ENGINEER" else "BACHELOR"

            for r in range(1, min(10, ws.max_row + 1)):
                val = str(ws.cell(r, 1).value or "")
                if "Học phần:" in val:
                    class_name = val.replace("Học phần:", "").strip()
                    match_grp = re.search(r'\((N\d+)\)', class_name)
                    if match_grp:
                        class_group = match_grp.group(1)
                    if "Việt - Anh" in class_name or "Việt Anh" in class_name:
                        program_type = "VIET_ANH"
                    elif "Khoa học máy tính" in class_name or "KHMT" in class_name:
                        program_type = "KHMT"
                    
                    if "Kỹ sư" in class_name or "KS" in class_name:
                        education_program = "ENGINEER"
                    elif "Cử nhân" in class_name or "CN" in class_name:
                        education_program = "BACHELOR"
                    break

            course_class, _ = CourseClass.objects.update_or_create(
                batch=batch,
                class_code=class_code,
                defaults={
                    "class_name": class_name,
                    "class_group": class_group,
                    "program_type": program_type,
                    "education_program": education_program
                }
            )

            # Find table header row
            header_row_idx = None
            col_mssv = None
            col_first_name = None
            col_last_name = None
            col_full_name = None
            col_class = None
            col_major = None
            col_phone = None
            col_email = None

            for r in range(1, min(15, ws.max_row + 1)):
                row_vals = [str(ws.cell(r, c).value or "").strip().lower() for c in range(1, ws.max_column + 1)]
                for c_idx, val in enumerate(row_vals, start=1):
                    if val in ["mã số sv", "mã sinh viên", "mssv", "mã sv", "masv"]:
                        header_row_idx = r
                        col_mssv = c_idx
                    elif val in ["họ và tên", "họ tên", "tên sinh viên", "hoten"]:
                        col_full_name = c_idx
                    elif val in ["họ và", "họ đệm", "họ"]:
                        col_last_name = c_idx
                    elif val in ["tên", "tên sv"]:
                        col_first_name = c_idx
                    elif val in ["lớp", "lớp sinh viên", "lớp quản lý", "lop"]:
                        col_class = c_idx
                    elif val in ["ngành", "chuyên ngành"]:
                        col_major = c_idx
                    elif val in ["điện thoại", "sđt", "so dien thoai", "phone"]:
                        col_phone = c_idx
                    elif val in ["email", "hòm thư"]:
                        col_email = c_idx

                if header_row_idx is not None and col_mssv is not None:
                    break

            if header_row_idx is None or col_mssv is None:
                continue

            for r in range(header_row_idx + 1, ws.max_row + 1):
                mssv_cell = ws.cell(r, col_mssv).value
                if not mssv_cell:
                    continue
                mssv = str(mssv_cell).strip()
                if not mssv or len(mssv) < 4:
                    continue

                total_count += 1
                try:
                    with transaction.atomic():
                        first_name = ""
                        last_name = ""
                        if col_full_name and ws.cell(r, col_full_name).value:
                            full_name = str(ws.cell(r, col_full_name).value).strip()
                            parts = full_name.split()
                            if len(parts) > 1:
                                last_name = " ".join(parts[:-1])
                                first_name = parts[-1]
                            else:
                                first_name = full_name
                        else:
                            if col_last_name and ws.cell(r, col_last_name).value:
                                last_name = str(ws.cell(r, col_last_name).value).strip()
                            if col_first_name and ws.cell(r, col_first_name).value:
                                first_name = str(ws.cell(r, col_first_name).value).strip()

                        student_class_name = ""
                        if col_class and ws.cell(r, col_class).value:
                            student_class_name = str(ws.cell(r, col_class).value).strip()

                        phone_number = ""
                        if col_phone and ws.cell(r, col_phone).value:
                            phone_number = str(ws.cell(r, col_phone).value).strip()

                        email = ""
                        if col_email and ws.cell(r, col_email).value:
                            email = str(ws.cell(r, col_email).value).strip()
                        if not email:
                            email = f"{mssv}@sv.utc.edu.vn"

                        username = mssv

                        detected_major = default_major
                        if col_major and ws.cell(r, col_major).value:
                            maj_val = str(ws.cell(r, col_major).value).strip().lower()
                            if "khoa học máy tính" in maj_val or "khmt" in maj_val:
                                detected_major = "KHMT"
                            else:
                                detected_major = "CNTT"

                        # Determine education program (Kỹ sư vs Cử nhân)
                        student_edu = education_program
                        combined_text = f"{student_class_name} {course_class.class_name}".lower()
                        if "kỹ sư" in combined_text or "ks" in combined_text:
                            student_edu = "ENGINEER"
                        elif "cử nhân" in combined_text or "cn" in combined_text:
                            student_edu = "BACHELOR"

                        if password_strategy == "FIXED" and custom_fixed_password:
                            plain_password = custom_fixed_password.strip()
                        elif password_strategy == "RANDOM":
                            plain_password = generate_random_password(8)
                        else:
                            plain_password = mssv

                        user, user_created = CustomUser.objects.get_or_create(
                            username=username,
                            defaults={
                                "email": email,
                                "first_name": first_name,
                                "last_name": last_name,
                                "user_type": "student",
                                "is_staff": False,
                                "is_active": True
                            }
                        )

                        if user_created:
                            user.set_password(plain_password)
                            user.save()
                        else:
                            if not user.first_name and first_name:
                                user.first_name = first_name
                                user.last_name = last_name
                                user.save(update_fields=["first_name", "last_name"])

                        student, std_created = Student.objects.update_or_create(
                            user=user,
                            defaults={
                                "registration_no": mssv,
                                "department": student_class_name or course_class.class_name,
                                "course_class": course_class,
                                "academic_batch": batch,
                                "batch_no": student_class_name,
                                "phone_number": phone_number,
                                "education_program": student_edu
                            }
                        )

                        action_status = "created" if (user_created or std_created) else "updated"
                        if action_status == "created":
                            created_count += 1
                        else:
                            updated_count += 1

                        created_accounts.append({
                            "id": user.id,
                            "username": username,
                            "full_name": f"{last_name} {first_name}".strip(),
                            "email": email,
                            "role": "student",
                            "major": detected_major,
                            "program_type": program_type,
                            "education_program": student_edu,
                            "class_name": student_class_name or course_class.class_name,
                            "plain_password": plain_password if user_created else "(Không đổi)",
                            "status": action_status
                        })

                except Exception as ex:
                    errors.append(f"Sheet '{sheet_name}', Dòng {r}, MSSV {mssv}: {str(ex)}")
                    skipped_count += 1

        return {
            "success": True,
            "total": total_count,
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": errors,
            "created_accounts": created_accounts
        }

    @staticmethod
    def generate_student_template():
        """
        Generate Excel template for importing UTC students.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        if ws is None:
            ws = wb.create_sheet()
        ws.title = "DS_Sinh_Vien"

        header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        border = Border(
            left=Side(style='thin', color='D0D5DD'),
            right=Side(style='thin', color='D0D5DD'),
            top=Side(style='thin', color='D0D5DD'),
            bottom=Side(style='thin', color='D0D5DD')
        )

        headers = [
            "STT",
            "Mã sinh viên (MSSV) *",
            "Họ đệm *",
            "Tên *",
            "Ngành (CNTT/KHMT) *",
            "Lớp sinh hoạt *",
            "Số điện thoại",
            "Email"
        ]

        ws.append(headers)
        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(1, col_num)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        sample_rows = [
            [1, "201200101", "Nguyễn Văn", "An", "CNTT", "CNTT 1 - K62", "0912345671", "201200101@lms.utc.edu.vn"],
            [2, "201200102", "Trần Thị", "Bình", "CNTT", "CNTT Việt Anh - K62", "0912345672", "201200102@lms.utc.edu.vn"],
            [3, "201200103", "Lê Hoàng", "Cường", "KHMT", "KHMT 1 - K62", "0912345673", "201200103@lms.utc.edu.vn"],
            [4, "201200104", "Phạm Minh", "Đức", "CNTT", "CNTT 2 - K62", "0912345674", "201200104@lms.utc.edu.vn"],
        ]

        for row in sample_rows:
            ws.append(row)

        for row in ws.iter_rows(min_row=2, max_row=len(sample_rows) + 1, min_col=1, max_col=len(headers)):
            for cell in row:
                cell.font = Font(name="Arial", size=10)
                cell.border = border
                if cell.column in [1, 2, 5]:
                    cell.alignment = Alignment(horizontal="center", vertical="center")

        ws.column_dimensions["A"].width = 8
        ws.column_dimensions["B"].width = 25
        ws.column_dimensions["C"].width = 20
        ws.column_dimensions["D"].width = 15
        ws.column_dimensions["E"].width = 22
        ws.column_dimensions["F"].width = 25
        ws.column_dimensions["G"].width = 18
        ws.column_dimensions["H"].width = 30

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer

    @staticmethod
    def export_users_to_excel(users_queryset, role="all"):
        """
        Export filtered users to Excel file.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        if ws is None:
            ws = wb.create_sheet()
        ws.title = "Danh_Sach_Tai_Khoan"

        header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        border = Border(
            left=Side(style='thin', color='E2E8F0'),
            right=Side(style='thin', color='E2E8F0'),
            top=Side(style='thin', color='E2E8F0'),
            bottom=Side(style='thin', color='E2E8F0')
        )

        headers = [
            "STT",
            "Tên đăng nhập (Username)",
            "Họ và tên",
            "Vai trò",
            "Ngành / Đơn vị",
            "Lớp / Bộ môn",
            "Khóa học / Đợt ĐATN",
            "GVHD / Đề tài",
            "Email",
            "Số điện thoại",
            "Trạng thái"
        ]

        ws.append(headers)
        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(1, col_num)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")

        stt = 1
        for user in users_queryset:
            full_name = user.get_full_name() or user.username
            role_display = {
                "student": "Sinh viên",
                "supervisor": "GV hướng dẫn",
                "committee_member": "Ủy viên HĐ",
                "external_examiner": "Cán bộ ngoài",
                "admin": "Quản trị viên"
            }.get(user.user_type, user.user_type)

            major_display = ""
            class_dept = ""
            batch_display = ""
            spv_topic = ""
            phone = ""

            if user.user_type == "student":
                std = getattr(user, "admin_student_profile", None)
                if std:
                    phone = std.phone_number or ""
                    class_dept = std.department or (std.course_class.class_name if std.course_class else "")
                    batch_display = std.academic_batch.batch_name if std.academic_batch else ""
                    if std.course_class and std.course_class.program_type == "KHMT":
                        major_display = "KHMT"
                    else:
                        major_display = "CNTT"

                    proj = getattr(std, "graduation_project", None)
                    if proj and proj.supervisor:
                        spv_topic = f"GVHD: {proj.supervisor.user.get_full_name()}"
            elif user.user_type == "supervisor":
                spv = getattr(user, "admin_supervisor_profile", None)
                if spv:
                    prefix = f"{spv.academic_title} " if spv.academic_title else ""
                    full_name = f"{prefix}{full_name}"
                    class_dept = spv.department_name or ""
                    phone = spv.phone_number or ""
                    major_display = "Giảng viên UTC"

            row_data = [
                stt,
                user.username,
                full_name,
                role_display,
                major_display,
                class_dept,
                batch_display,
                spv_topic,
                user.email,
                phone,
                "Hoạt động" if user.is_active else "Vô hiệu hóa"
            ]
            ws.append(row_data)
            stt += 1

        for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=1, max_col=len(headers)):
            for cell in row:
                cell.font = Font(name="Arial", size=10)
                cell.border = border
                if cell.column in [1, 2, 4, 5, 7, 11]:
                    cell.alignment = Alignment(horizontal="center", vertical="center")

        ws.column_dimensions["A"].width = 8
        ws.column_dimensions["B"].width = 25
        ws.column_dimensions["C"].width = 24
        ws.column_dimensions["D"].width = 18
        ws.column_dimensions["E"].width = 20
        ws.column_dimensions["F"].width = 24
        ws.column_dimensions["G"].width = 22
        ws.column_dimensions["H"].width = 25
        ws.column_dimensions["I"].width = 28
        ws.column_dimensions["J"].width = 18
        ws.column_dimensions["K"].width = 16

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer

    @staticmethod
    def import_eligibility_from_excel(file_obj, batch_id):
        """
        Giai đoạn 4: Import kết quả xét điều kiện làm đồ án (GPA, số tín chỉ nợ, kết luận Đủ / Không đủ).
        """
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {"success": False, "error": f"Không tìm thấy đợt ID {batch_id}."}

        try:
            wb = openpyxl.load_workbook(file_obj, data_only=True)
            ws = wb.active
        except Exception as ex:
            return {"success": False, "error": f"Lỗi đọc file Excel: {str(ex)}"}

        total = 0
        eligible_count = 0
        ineligible_count = 0
        updated_projects = []

        header_row = 1
        col_mssv = None
        col_gpa = None
        col_credits = None
        col_verdict = None
        col_reason = None

        for r in range(1, min(10, ws.max_row + 1)):
            for c in range(1, ws.max_column + 1):
                v = str(ws.cell(r, c).value or "").strip().lower()
                if v in ["mssv", "mã sv", "mã sinh viên"]:
                    col_mssv = c
                    header_row = r
                elif v in ["gpa", "điểm tích lũy", "điểm tl"]:
                    col_gpa = c
                elif v in ["tín chỉ nợ", "tc nợ", "nợ tín chỉ"]:
                    col_credits = c
                elif v in ["kết luận", "điều kiện", "kết quả", "trạng thái"]:
                    col_verdict = c
                elif v in ["lý do", "ghi chú"]:
                    col_reason = c

        if not col_mssv:
            col_mssv = 1 # fallback cột 1

        with transaction.atomic():
            for r in range(header_row + 1, ws.max_row + 1):
                mssv_val = ws.cell(r, col_mssv).value
                if not mssv_val:
                    continue
                mssv = str(mssv_val).strip()
                student = Student.objects.filter(academic_batch=batch, registration_no=mssv).first()
                if not student:
                    continue

                total += 1
                gpa = 0.0
                if col_gpa and ws.cell(r, col_gpa).value:
                    try:
                        gpa = float(ws.cell(r, col_gpa).value)
                    except:
                        pass

                debt_cred = 0
                if col_credits and ws.cell(r, col_credits).value:
                    try:
                        debt_cred = int(ws.cell(r, col_credits).value)
                    except:
                        pass

                verdict_str = ""
                if col_verdict and ws.cell(r, col_verdict).value:
                    verdict_str = str(ws.cell(r, col_verdict).value).strip().lower()

                reason_str = ""
                if col_reason and ws.cell(r, col_reason).value:
                    reason_str = str(ws.cell(r, col_reason).value).strip()

                is_eligible = True
                if "không" in verdict_str or "trượt" in verdict_str or "loại" in verdict_str or (debt_cred > 8) or (gpa < 1.9 and gpa > 0):
                    is_eligible = False
                    if not reason_str:
                        reason_str = f"Nợ {debt_cred} tín chỉ / GPA {gpa} không đạt chuẩn"

                status_val = "ELIGIBLE" if is_eligible else "INELIGIBLE"
                if is_eligible:
                    eligible_count += 1
                else:
                    ineligible_count += 1

                proj = getattr(student, "graduation_project", None)
                if proj:
                    proj.gpa_score = gpa
                    proj.debt_credits = debt_cred
                    proj.initial_eligibility = status_val
                    proj.ineligibility_reason = reason_str
                    proj.save(update_fields=["gpa_score", "debt_credits", "initial_eligibility", "ineligibility_reason"])

                    updated_projects.append({
                        "student_name": student.user.get_full_name(),
                        "registration_no": mssv,
                        "gpa": gpa,
                        "debt_credits": debt_cred,
                        "status": status_val,
                        "reason": reason_str
                    })

            batch.current_stage = "PHASE_4_ELIGIBILITY"
            batch.save(update_fields=["current_stage"])

        return {
            "success": True,
            "total_processed": total,
            "eligible_count": eligible_count,
            "ineligible_count": ineligible_count,
            "updated_list": updated_projects
        }

    @staticmethod
    def import_final_academic_status(file_obj, batch_id):
        """
        Giai đoạn 6: Import rà soát điều kiện học vụ cuối (Chuẩn đầu ra ngoại ngữ, công nợ học phí, v.v.).
        """
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {"success": False, "error": f"Không tìm thấy đợt ID {batch_id}."}

        try:
            wb = openpyxl.load_workbook(file_obj, data_only=True)
            ws = wb.active
        except Exception as ex:
            return {"success": False, "error": f"Lỗi đọc file: {str(ex)}"}

        total = 0
        eligible_count = 0
        ineligible_count = 0
        updated = []

        with transaction.atomic():
            for r in range(2, ws.max_row + 1):
                mssv_cell = ws.cell(r, 1).value or ws.cell(r, 2).value
                if not mssv_cell:
                    continue
                mssv = str(mssv_cell).strip()
                student = Student.objects.filter(academic_batch=batch, registration_no=mssv).first()
                if not student:
                    continue

                proj = getattr(student, "graduation_project", None)
                if not proj:
                    continue

                # Cột 3: Trạng thái (Đạt / Không đạt / Đủ / Không đủ)
                status_raw = str(ws.cell(r, 3).value or "Đủ").strip().lower()
                note = str(ws.cell(r, 4).value or "").strip()

                is_ok = ("không" not in status_raw and "chưa" not in status_raw)
                total += 1

                if is_ok:
                    eligible_count += 1
                    proj.final_academic_eligibility = "ELIGIBLE"
                    proj.final_academic_notes = note
                    # Nếu GVHD đã duyệt đủ điều kiện và học vụ đạt -> Sẵn sàng bảo vệ
                    if proj.supervisor_defense_confirmed or proj.is_eligible_for_defense:
                        proj.is_eligible_for_defense = True
                        proj.status = "DEFENSE_READY"
                else:
                    ineligible_count += 1
                    proj.final_academic_eligibility = "INELIGIBLE"
                    proj.final_academic_notes = note or "Chưa đạt chuẩn đầu ra ngoại ngữ hoặc nợ học phí"
                    # Chuyển sang chờ xét bảo lưu
                    proj.deferral_status = "REQUESTED"
                    proj.deferral_reason = proj.final_academic_notes

                proj.save()
                updated.append({
                    "registration_no": mssv,
                    "student_name": student.user.get_full_name(),
                    "final_academic": proj.final_academic_eligibility,
                    "deferral_status": proj.deferral_status,
                    "status": proj.status
                })

        return {
            "success": True,
            "total": total,
            "eligible_count": eligible_count,
            "ineligible_count": ineligible_count,
            "results": updated
        }
