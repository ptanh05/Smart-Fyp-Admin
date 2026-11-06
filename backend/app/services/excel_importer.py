import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
import io
import re
import random
import string
from django.db import transaction
from django.contrib.auth.hashers import make_password
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


def _infer_mssv_column(ws):
    """Tự suy luận cột chứa Mã sinh viên khi file không có dòng tiêu đề chuẩn.

    Chiến lược: quét các dòng dữ liệu, thử từng cột và chấm điểm theo số lượng
    giá trị khớp mẫu MSSV UTC (9 chữ số). Cột có tỉ lệ khớp cao nhất và đủ số
    lượng mẫu sẽ được chọn.

    Trả về chỉ số cột (1-based) hoặc None nếu không xác định được.
    """
    if not ws or ws.max_row < 1 or ws.max_column < 1:
        return None

    sample_rows = list(range(1, min(ws.max_row, 60) + 1))
    if not sample_rows:
        return None

    best_col, best_ratio, best_count = None, 0.0, 0

    for col in range(1, ws.max_column + 1):
        matches = 0
        considered = 0
        for r in sample_rows:
            val = ws.cell(r, col).value
            if val is None or str(val).strip() == "":
                continue
            considered += 1
            s = str(val).strip()
            if s.endswith(".0"):
                s = s[:-2]
            if re.match(r"^\d{9}$", s):
                matches += 1

        if considered == 0 or matches == 0:
            continue

        ratio = matches / considered
        # Yêu cầu tỉ lệ khớp cao (>=60%). Nếu sheet chỉ có 1 dòng dữ liệu thì
        # vẫn chấp nhận (ratio = 1.0) vì các cột khác không thể chứa toàn
        # giá trị 9 chữ số.
        if ratio < 0.6:
            continue
        if matches > best_count or (matches == best_count and ratio > best_ratio):
            best_col, best_ratio, best_count = col, ratio, matches

    return best_col


def _infer_name_column(ws, exclude_col=None):
    """Tự suy luận cột chứa Họ tên khi không có dòng tiêu đề.

    Chọn cột (khác cột MSSV) có nhiều giá trị chữ khác nhau nhất.
    """
    if not ws or ws.max_row < 1 or ws.max_column < 1:
        return None

    sample_rows = list(range(1, min(ws.max_row, 60) + 1))
    best_col, best_score = None, 0

    for col in range(1, ws.max_column + 1):
        if exclude_col and col == exclude_col:
            continue
        values = []
        for r in sample_rows:
            val = ws.cell(r, col).value
            if val is None:
                continue
            s = str(val).strip()
            if not s or re.match(r"^\d+$", s):
                continue
            values.append(s)
        if len(values) < 2:
            continue
        # Ưu tiên cột có tên nhiều từ (họ + tên) và nhiều giá trị khác nhau.
        unique = len(set(values))
        multiword = sum(1 for v in values if len(v.split()) >= 2)
        score = multiword * 2 + unique
        if score > best_score:
            best_score, best_col = score, col

    return best_col

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

            is_generic_sheet = (
                class_code.lower() in [
                    "ds_sinh_vien", "dssv", "danh_sach", "danhsach", "sheet1", "sheet_1", "danh sách"
                ]
                or any(k in class_code.lower() for k in ["danh sách", "danh sach", "sinh viên", "sinh vien", "sheet", "dssv", "student", "hoc vien"])
            )

            course_class = None
            if not is_generic_sheet:
                course_class = CourseClass.objects.filter(batch=batch, class_code=class_code).first()
                if not course_class:
                    course_class = CourseClass.objects.create(
                        batch=batch,
                        class_code=class_code,
                        class_name=class_name,
                        class_group=class_group,
                        program_type=program_type,
                        education_program=education_program
                    )
                else:
                    course_class.class_name = class_name
                    course_class.class_group = class_group
                    course_class.program_type = program_type
                    course_class.education_program = education_program
                    course_class.save()

            # Find table header row with robust fuzzy & normalized matching
            header_row_idx = None
            col_mssv = None
            col_first_name = None
            col_last_name = None
            col_full_name = None
            col_class = None
            col_major = None
            col_phone = None
            col_email = None

            def _clean_header_cell(val):
                if not val:
                    return ""
                s = str(val).strip().lower()
                s = s.replace("*", "").replace(":", "").replace("(", " ").replace(")", " ")
                s = re.sub(r"\s+", " ", s)
                return s.strip()

            def _is_blank(val):
                return val is None or str(val).strip() == ""

            # --- Điểm số cho từng cột, chọn cột MSSV theo điểm cao nhất ---
            # Bảng từ khóa mở rộng để nhận diện được file xuất từ Cổng đào tạo UTC,
            # file export mẫu của hệ thống, và file do Khoa tự chỉnh sửa.
            MSSV_STRONG_KEYS = [
                "mã sinh viên", "ma sinh vien", "mã số sinh viên", "ma so sinh vien",
                "mssv", "mã sv", "ma sv", "masv", "mã số sv", "ma so sv",
                "student id", "student_id", "studentid", "mã trình", "số hiệu sinh viên",
            ]
            # Từ khóa mơ hồ: chỉ dùng khi không tìm được từ khóa mạnh.
            MSSV_WEAK_KEYS = ["sinh viên", "sinh vien", "mã", "ma"]
            MSSV_KEYS = MSSV_STRONG_KEYS + MSSV_WEAK_KEYS
            FULLNAME_KEYS = [
                "họ và tên", "ho va ten", "họ tên", "ho ten", "họ và tên sinh viên",
                "tên sinh viên", "ten sinh vien", "full name", "fullname", "hoten",
                "họ và tên đầy đủ",
            ]
            LASTNAME_KEYS = [
                "họ đệm", "ho dem", "họ và tên", "họ lót", "ho lot", "họ",
                "last name", "lastname", "họ và tên cuối",
            ]
            FIRSTNAME_KEYS = [
                "tên", "ten", "tên sv", "ten sinh vien", "first name", "firstname",
                "tên thật",
            ]
            CLASS_KEYS = [
                "lớp sinh hoạt", "lop sinh hoat", "lớp quản lý", "lop quan ly",
                "lớp sinh viên", "lop sinh vien", "lớp", "lop", "class", "course class",
                "course_class", "lớp học", "lop hoc", "nhóm", "nhom",
            ]
            MAJOR_KEYS = ["ngành", "nganh", "chuyên ngành", "chuyen nganh", "major", "khoa"]
            PHONE_KEYS = [
                "số điện thoại", "so dien thoai", "điện thoại", "dien thoai",
                "sđt", "sdt", "phone", "mobile", "số di động", "so di dong",
                "điện thoại liên hệ",
            ]
            EMAIL_KEYS = ["email", "e-mail", "hòm thư", "hom thu", "mail", "thư điện tử"]

            def _match_col(row_vals, keywords, exclude_keywords=(), exclude_cols=()):
                """Trả về (col_index, điểm) cho cột khớp từ khóa."""
                best_idx, best_score = None, 0
                for c_idx, val in enumerate(row_vals, start=1):
                    if not val:
                        continue
                    if c_idx in exclude_cols:
                        continue
                    if any(ex in val for ex in exclude_keywords):
                        continue
                    for kw in keywords:
                        if kw == val:
                            score = 100
                        elif kw in val:
                            score = 60 + len(kw)
                        else:
                            continue
                        # Ưu tiên cột có từ khóa dài / khớp chính xác
                        if score > best_score:
                            best_score, best_idx = score, c_idx
                return best_idx, best_score

            for r in range(1, min(60, ws.max_row + 1)):
                row_vals = [_clean_header_cell(ws.cell(r, c).value) for c in range(1, ws.max_column + 1)]
                if not any(row_vals):
                    continue

                # Ưu tiên cột MSSV khớp CHÍNH XÁC từ khóa mạnh (mã sv, mssv, mã số sv...)
                # trước; các từ khóa mơ hồ ("sinh viên") chỉ dùng làm phương án dự phòng.
                cand_mssv, score_mssv = _match_col(row_vals, MSSV_STRONG_KEYS)
                if cand_mssv is None:
                    # Từ khóa mơ hồ: loại trừ các cột họ tên để không chọn nhầm
                    # cột "Họ và tên sinh viên" làm cột MSSV.
                    cand_mssv, score_mssv = _match_col(
                        row_vals, MSSV_WEAK_KEYS,
                        exclude_keywords=("họ", "ho", "tên sinh viên", "ten sinh vien"),
                    )
                if cand_mssv is None:
                    continue

                # Chỉ coi là hàng header nếu bên cạnh cột MSSV có thêm ít nhất
                # 1 cột thông tin khác (tên / lớp / ngành / STT...) => tránh nhầm
                # dòng dữ liệu đầu tiên làm header.
                other_cols = sum(
                    1 for v in row_vals
                    if v and not any(k in v for k in MSSV_KEYS)
                )
                has_support = any(
                    _match_col(row_vals, kws)[0] is not None
                    for kws in (FULLNAME_KEYS, LASTNAME_KEYS, FIRSTNAME_KEYS, CLASS_KEYS, MAJOR_KEYS)
                )
                if score_mssv < 70 and not (has_support and other_cols >= 2):
                    continue

                header_row_idx = r
                col_mssv = cand_mssv

                # Tên: loại trừ cột MSSV để không chọn nhầm "Sinh viên" làm cột họ tên.
                cand_full, _ = _match_col(
                    row_vals, FULLNAME_KEYS,
                    exclude_keywords=("họ đệm", "ho dem"),
                    exclude_cols=(col_mssv,),
                )
                if cand_full:
                    col_full_name = cand_full
                else:
                    cand_last, _ = _match_col(row_vals, LASTNAME_KEYS, exclude_cols=(col_mssv,))
                    cand_first, _ = _match_col(
                        row_vals, FIRSTNAME_KEYS,
                        exclude_keywords=("họ", "ho"),
                        exclude_cols=(col_mssv,),
                    )
                    if cand_last:
                        col_last_name = cand_last
                    if cand_first:
                        col_first_name = cand_first
                cand_class, _ = _match_col(row_vals, CLASS_KEYS, exclude_cols=(col_mssv,))
                if cand_class:
                    col_class = cand_class
                cand_major, _ = _match_col(row_vals, MAJOR_KEYS, exclude_cols=(col_mssv,))
                if cand_major:
                    col_major = cand_major
                cand_phone, _ = _match_col(row_vals, PHONE_KEYS, exclude_cols=(col_mssv,))
                if cand_phone:
                    col_phone = cand_phone
                cand_email, _ = _match_col(row_vals, EMAIL_KEYS, exclude_cols=(col_mssv,))
                if cand_email:
                    col_email = cand_email
                break

            # --- FALLBACK: Nếu không dò được header, tự suy luận cột MSSV từ dữ liệu ---
            if col_mssv is None:
                col_mssv = _infer_mssv_column(ws)
                if col_mssv is not None:
                    header_row_idx = 0  # coi như không có hàng header, bắt đầu đọc từ dòng 1
                    col_full_name = _infer_name_column(ws, exclude_col=col_mssv)
                    errors.append(
                        f"Sheet '{sheet_name}': Không tìm thấy dòng tiêu đề chuẩn. "
                        f"Hệ thống tự động nhận diện cột Mã sinh viên ở cột {col_mssv}."
                    )

            if header_row_idx is None or col_mssv is None:
                errors.append(
                    f"Sheet '{sheet_name}': Không tìm thấy cột 'Mã sinh viên (MSSV)' "
                    f"và không thể tự động nhận diện. Sheet này bị bỏ qua."
                )
                continue

            # First pass: collect valid rows to pre-fetch in batch (drastically accelerates import)
            valid_rows = []
            data_start_row = (header_row_idx or 0) + 1
            for r in range(data_start_row, ws.max_row + 1):
                mssv_cell = ws.cell(r, col_mssv).value
                if not mssv_cell:
                    continue
                mssv = str(mssv_cell).strip()
                if mssv.endswith('.0'):
                    mssv = mssv[:-2]

                # TC: Validate UTC Student Code (Must be exactly 9 digits)
                if not re.match(r"^\d{9}$", mssv):
                    # Ô chứa chữ (không phải số) => nhiều khả năng là dòng tiêu đề lặp lại
                    # hoặc dòng ghi chú ở cuối bảng -> bỏ qua im lặng.
                    if not re.match(r"^\d+$", mssv):
                        continue
                    # Bỏ qua dòng tiêu đề lặp lại / dòng tổng kết, không báo lỗi.
                    low = mssv.lower()
                    if low in ("stt", "mssv", "mã sv", "mã sinh viên", "tổng", "total"):
                        continue
                    skipped_count += 1
                    errors.append(f"Dòng {r}: Mã sinh viên '{mssv}' không hợp lệ (Mã sinh viên UTC phải gồm đúng 9 chữ số).")
                    continue

                valid_rows.append((r, mssv))

            if not valid_rows:
                errors.append(
                    f"Sheet '{sheet_name}': Không có dòng dữ liệu sinh viên hợp lệ "
                    f"(MSSV phải gồm đúng 9 chữ số)."
                )
                continue

            # Pre-fetch existing users, students, and course classes in single queries
            all_valid_mssvs = [v[1] for v in valid_rows]
            existing_users = {u.username: u for u in CustomUser.objects.filter(username__in=all_valid_mssvs)}
            existing_students = {s.registration_no: s for s in Student.objects.filter(registration_no__in=all_valid_mssvs).select_related('user')}
            cached_classes = {c.class_code: c for c in CourseClass.objects.filter(batch=batch)}

            for r, mssv in valid_rows:
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

                        if not first_name and not last_name:
                            skipped_count += 1
                            errors.append(f"Dòng {r}: Thiếu họ và tên sinh viên (MSSV: {mssv}).")
                            continue

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
                        course_cls_name = course_class.class_name if course_class else ""
                        combined_text = f"{student_class_name} {course_cls_name}".lower()
                        if "kỹ sư" in combined_text or "ks" in combined_text:
                            student_edu = "ENGINEER"
                        elif "cử nhân" in combined_text or "cn" in combined_text:
                            student_edu = "BACHELOR"

                        # Map to administrative class (Lớp sinh hoạt) if specified
                        assigned_course_class = course_class
                        if student_class_name:
                            cls_prog = "DAI_TRA"
                            sc_lower = student_class_name.lower()
                            if "việt anh" in sc_lower or "việt - anh" in sc_lower:
                                cls_prog = "VIET_ANH"
                            elif "khmt" in sc_lower or "khoa học máy tính" in sc_lower or detected_major == "KHMT":
                                cls_prog = "KHMT"

                            assigned_course_class = cached_classes.get(student_class_name)
                            if not assigned_course_class:
                                assigned_course_class = CourseClass.objects.filter(batch=batch, class_code=student_class_name).first()
                                if not assigned_course_class:
                                    assigned_course_class = CourseClass.objects.create(
                                        batch=batch,
                                        class_code=student_class_name,
                                        class_name=student_class_name,
                                        class_group="",
                                        program_type=cls_prog,
                                        education_program=student_edu
                                    )
                                cached_classes[student_class_name] = assigned_course_class
                        elif not assigned_course_class:
                            cls_code = f"CNTT_{batch.batch_code}"
                            assigned_course_class = cached_classes.get(cls_code)
                            if not assigned_course_class:
                                assigned_course_class = CourseClass.objects.filter(batch=batch, class_code=cls_code).first()
                                if not assigned_course_class:
                                    assigned_course_class = CourseClass.objects.create(
                                        batch=batch,
                                        class_code=cls_code,
                                        class_name=f"Lớp {cls_code}",
                                        class_group="",
                                        program_type="DAI_TRA",
                                        education_program=student_edu
                                    )
                                cached_classes[cls_code] = assigned_course_class

                        if password_strategy == "FIXED" and custom_fixed_password:
                            plain_password = custom_fixed_password.strip()
                        elif password_strategy == "RANDOM":
                            plain_password = generate_random_password(8)
                        else:
                            plain_password = mssv

                        user = existing_users.get(username)
                        user_created = False
                        if not user:
                            user = CustomUser.objects.filter(username=username).first()
                        if not user:
                            user = CustomUser.objects.create(
                                username=username,
                                email=email,
                                first_name=first_name,
                                last_name=last_name,
                                user_type="student",
                                is_staff=False,
                                is_active=True,
                                password=make_password(plain_password, hasher="md5")
                            )
                            user_created = True
                            existing_users[username] = user
                        else:
                            fields_to_update = []
                            if not user.first_name and first_name:
                                user.first_name = first_name
                                fields_to_update.append("first_name")
                            if not user.last_name and last_name:
                                user.last_name = last_name
                                fields_to_update.append("last_name")
                            if fields_to_update:
                                user.save(update_fields=fields_to_update)

                        dept_name = student_class_name or (assigned_course_class.class_name if assigned_course_class else f"Lớp CNTT_{batch.batch_code}")
                        student = existing_students.get(mssv)
                        std_created = False
                        if not student:
                            student = Student.objects.filter(registration_no=mssv).first()
                        if not student:
                            student = Student.objects.filter(user=user).first()

                        if not student:
                            student = Student.objects.create(
                                user=user,
                                registration_no=mssv,
                                department=dept_name,
                                course_class=assigned_course_class,
                                academic_batch=batch,
                                batch_no=student_class_name,
                                phone_number=phone_number,
                                education_program=student_edu
                            )
                            std_created = True
                            existing_students[mssv] = student
                        else:
                            student.user = user
                            student.academic_batch = batch
                            if assigned_course_class:
                                student.course_class = assigned_course_class
                            if dept_name:
                                student.department = dept_name
                            if student_class_name:
                                student.batch_no = student_class_name
                            if phone_number:
                                student.phone_number = phone_number
                            student.education_program = student_edu
                            student.save()
                            existing_students[mssv] = student

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
                            "class_name": dept_name,
                            "plain_password": plain_password if user_created else "(Không đổi)",
                            "status": action_status
                        })

                except Exception as ex:
                    errors.append(f"Sheet '{sheet_name}', Dòng {r}, MSSV {mssv}: {str(ex)}")
                    skipped_count += 1

        # Nếu không import được dòng nào -> báo rõ nguyên nhân để Admin không bị "im lặng"
        if total_count == 0:
            if not errors:
                errors.append(
                    "File Excel không có dòng dữ liệu sinh viên nào. "
                    "Vui lòng kiểm tra lại nội dung file hoặc tải file mẫu từ nút 'Tải mẫu Import'."
                )
            else:
                errors.insert(0, (
                    "⚠️ KHÔNG import được dòng dữ liệu nào. "
                    "Vui lòng kiểm tra các lỗi bên dưới, hoặc tải file mẫu chuẩn từ nút 'Tải mẫu Import' "
                    "để đảm bảo định dạng cột (Mã sinh viên = 9 chữ số) đúng."
                ))

        # Delete unused placeholder sheet classes if specific classes were created with students
        try:
            CourseClass.objects.filter(
                batch=batch,
                students__isnull=True,
                class_code__in=["Sheet1", "Sheet 1", "Trang 1", "DS_Sinh_Vien", "dssv", "DS_Sinh_Vien ", "DanhSach"]
            ).delete()
        except Exception:
            pass

        # Invalidate related caches immediately
        try:
            from django.core.cache import cache
            cache.delete("admin_academic_batches_list")
            cache.delete("admin_security_metrics_overview")
            cache.delete("admin_user_summary_counts")
        except Exception:
            pass

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
    def generate_sample_roster():
        """
        Sinh file Excel danh sách sinh viên MẪU (nhiều lớp, có dữ liệu đầy đủ)
        để Admin dùng ngay cho việc test chức năng Import.

        File gồm nhiều sheet mô phỏng danh sách theo lớp học phần UTC:
        - Các sheet lớp: có dòng "Học phần: ..." ở trên + tiêu đề bảng ở dòng 3
          (mô phỏng file xuất từ Cổng đào tạo UTC).
        - Sheet "Danh_Sach_Sinh_Vien": tiêu đề ngay dòng 1 (định dạng file export mẫu).

        MSSV sinh ra luôn là 9 chữ số và KHÔNG trùng với dữ liệu đang có trong
        hệ thống (dùng tiền tố 241/242 tương ứng CNTT/KHMT).
        """
        import random

        # Tiền tố MSSV: 241 = CNTT, 242 = KHMT (tránh trùng dữ liệu đang có)
        # MSSV UTC = 9 chữ số = 4 chữ tiền tố + 5 chữ số thứ tự.
        class_specs = [
            ("CNTT1 - K62", "CNTT1 - K62", 18, "CNTT", False, "2411"),
            ("CNTT2 - K62", "CNTT2 - K62", 16, "CNTT", False, "2412"),
            ("CNTT3 - K62", "CNTT3 - K62", 15, "CNTT", False, "2413"),
            ("CNTT Việt Anh - K62", "CNTT Việt Anh - K62", 10, "CNTT", False, "2414"),
            ("CNTT Kỹ sư 1 - K62", "CNTT Kỹ sư 1 - K62", 12, "CNTT", True, "2415"),
            ("CNTT Kỹ sư 2 - K62", "CNTT Kỹ sư 2 - K62", 11, "CNTT", True, "2416"),
            ("KHMT1 - K62", "KHMT1 - K62", 14, "KHMT", False, "2421"),
            ("KHMT2 - K62", "KHMT2 - K62", 12, "KHMT", False, "2422"),
        ]

        ho_list = [
            "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Võ", "Đặng", "Bùi",
            "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Trịnh", "Cao", "Mai", "Trương",
            "Tạ", "Hà", "Kiều", "Lương", "Chu", "Tô", "Đoàn", "Lâm", "Hứa", "Vương",
        ]
        ten_list = [
            "Văn An", "Thị Bình", "Hoàng Cường", "Minh Đức", "Thị Hà", "Quốc Huy",
            "Ngọc Lan", "Thu Trang", "Đình Nam", "Hải Phong", "Mai Phương", "Quỳnh Nhi",
            "Thành Long", "Khánh Linh", "Gia Bảo", "Phương Chi", "Tuấn Kiệt", "Thùy Dung",
            "Hoài An", "Hữu Phước", "Diệu Linh", "Vĩnh Phú", "Thanh Tùng", "Như Ý",
            "Đông Triều", "Bảo Châu", "Khắc Duy", "Hoài Thu", "Trọng Nghĩa", "Mỹ Duyên",
        ]
        ten_nam_list = [
            "Văn An", "Hoàng Cường", "Minh Đức", "Quốc Huy", "Đình Nam", "Hải Phong",
            "Thành Long", "Gia Bảo", "Tuấn Kiệt", "Hoài An", "Hữu Phước", "Vĩnh Phú",
            "Thanh Tùng", "Đông Triều", "Khắc Duy", "Trọng Nghĩa", "Quang Huy", "Văn Kiên",
            "Trung Kiên", "Đức Anh", "Ngọc Bảo", "Hải Đăng", "Gia Huy", "Trí Thức",
        ]

        headers = [
            "STT",
            "Mã sinh viên (MSSV) *",
            "Họ đệm *",
            "Tên *",
            "Ngành (CNTT/KHMT) *",
            "Lớp sinh hoạt *",
            "Hệ đào tạo",
            "Số điện thoại",
            "Email",
        ]
        widths = [8, 24, 20, 16, 22, 26, 14, 16, 30]

        header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        border = Border(
            left=Side(style='thin', color='D0D5DD'),
            right=Side(style='thin', color='D0D5DD'),
            top=Side(style='thin', color='D0D5DD'),
            bottom=Side(style='thin', color='D0D5DD')
        )
        body_font = Font(name="Arial", size=10)

        random.seed(20261106)
        wb = openpyxl.Workbook()
        wb.remove(wb.active)

        def _style_header(ws, row_idx):
            for c, h in enumerate(headers, start=1):
                cell = ws.cell(row_idx, c, h)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            ws.row_dimensions[row_idx].height = 32

        def _style_body(ws, row_idx, values):
            for c, v in enumerate(values, start=1):
                cell = ws.cell(row_idx, c, v)
                cell.font = body_font
                cell.border = border
                if c in (1, 2, 5, 7):
                    cell.alignment = Alignment(horizontal="center", vertical="center")

        def _make_row(stt, mssv, lop_name, nganh, la_ky_su):
            is_nam = random.random() < 0.55
            return [
                stt,
                mssv,
                random.choice(ho_list),
                random.choice(ten_nam_list if is_nam else ten_list),
                nganh,
                lop_name,
                "Kỹ sư" if la_ky_su else "Cử nhân",
                f"09{random.randint(10, 99)}{random.randint(100000, 999999)}",
                f"{mssv}@sv.utc.edu.vn",
            ]

        # --- Các sheet theo lớp học phần (mô phỏng file Cổng đào tạo UTC) ---
        for idx, (sheet_name, lop_name, so_sv, nganh, la_ky_su, prefix) in enumerate(class_specs):
            ws = wb.create_sheet(title=sheet_name[:31])

            hoc_phan = "Học phần: Đồ án tốt nghiệp"
            if la_ky_su:
                hoc_phan += " Kỹ sư"
            hoc_phan += f" CNTT-{idx + 1}-1-26(N{idx + 1:02d}).DA"
            ws.cell(1, 1, hoc_phan)
            ws.cell(1, 1).font = Font(name="Arial", size=11, bold=True, italic=True, color="475569")

            header_row = 3
            _style_header(ws, header_row)

            for i in range(so_sv):
                mssv = f"{prefix}{i + 1:05d}"
                _style_body(ws, header_row + i + 1, _make_row(i + 1, mssv, lop_name, nganh, la_ky_su))

            for c_idx, w in enumerate(widths, start=1):
                ws.column_dimensions[chr(64 + c_idx)].width = w

        # --- Sheet tổng hợp: header ngay dòng 1 (định dạng file export mẫu) ---
        ws_sum = wb.create_sheet(title="Danh_Sach_Sinh_Vien")
        _style_header(ws_sum, 1)
        stt = 0
        for (_s, lop_name, so_sv, nganh, la_ky_su, prefix) in class_specs:
            for i in range(so_sv):
                stt += 1
                mssv = f"{prefix}{1000 + i + 1:05d}"
                _style_body(ws_sum, 1 + stt, _make_row(stt, mssv, lop_name, nganh, la_ky_su))
        for c_idx, w in enumerate(widths, start=1):
            ws_sum.column_dimensions[chr(64 + c_idx)].width = w

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
    def export_students_import_format(batch_id):
        """
        Export danh sách sinh viên thuộc Đợt ĐATN ra file Excel có định dạng CỘT giống 100% file lúc Import.
        Người dùng có thể xuất file, chỉnh sửa và import ngược lại hệ thống mà không bị lỗi.
        """
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            batch = AcademicBatch.objects.filter(is_active=True).first()

        wb = openpyxl.Workbook()
        ws = wb.active
        if ws is None:
            ws = wb.create_sheet()
        ws.title = "Danh_Sach_Sinh_Vien"

        header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
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
            "Hệ đào tạo",
            "Số điện thoại",
            "Email"
        ]

        ws.append(headers)
        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(1, col_num)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        students_qs = Student.objects.filter(academic_batch=batch).select_related("user", "course_class").order_by("registration_no") if batch else Student.objects.none()

        stt = 1
        for s in students_qs:
            user = s.user
            first_n = user.first_name or ""
            last_n = user.last_name or ""
            if not first_n and not last_n:
                parts = (user.get_full_name() or user.username).split()
                if len(parts) > 1:
                    first_n = parts[-1]
                    last_n = " ".join(parts[:-1])
                else:
                    first_n = user.username

            c_name = ""
            if s.course_class:
                c_name = s.course_class.class_name
            elif s.department:
                c_name = s.department
            elif s.batch_no:
                c_name = s.batch_no

            major_val = "CNTT"
            if s.course_class and s.course_class.program_type == "KHMT":
                major_val = "KHMT"
            elif s.department and "KHMT" in s.department.upper():
                major_val = "KHMT"

            edu_val = "Kỹ sư" if s.education_program == "ENGINEER" else "Cử nhân"

            row = [
                stt,
                s.registration_no,
                last_n,
                first_n,
                major_val,
                c_name,
                edu_val,
                s.phone_number or "",
                user.email or f"{s.registration_no}@sv.utc.edu.vn"
            ]
            ws.append(row)
            stt += 1

        for row in ws.iter_rows(min_row=2, max_row=max(2, ws.max_row), min_col=1, max_col=len(headers)):
            for cell in row:
                cell.font = Font(name="Arial", size=10)
                cell.border = border
                if cell.column in [1, 2, 5, 7]:
                    cell.alignment = Alignment(horizontal="center", vertical="center")

        ws.column_dimensions["A"].width = 8
        ws.column_dimensions["B"].width = 24
        ws.column_dimensions["C"].width = 20
        ws.column_dimensions["D"].width = 15
        ws.column_dimensions["E"].width = 22
        ws.column_dimensions["F"].width = 25
        ws.column_dimensions["G"].width = 16
        ws.column_dimensions["H"].width = 18
        ws.column_dimensions["I"].width = 32

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
                if v in ["mssv", "mã sv", "mã sinh viên", "mã số sinh viên", "masv"]:
                    col_mssv = c
                    header_row = r
                elif "gpa" in v or "tích lũy" in v or "điểm tl" in v:
                    col_gpa = c
                elif "nợ" in v or "tín chỉ nợ" in v or "tc nợ" in v or "debt" in v:
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

                # Xét điều kiện theo quy chế UTC: Nợ < 10 tín chỉ: Đủ điều kiện; Nợ >= 10 tín chỉ: Không đủ điều kiện (chờ Khoa xét)
                is_eligible = (debt_cred < 10)
                if "không" in verdict_str or "trượt" in verdict_str or "loại" in verdict_str:
                    is_eligible = False

                if is_eligible:
                    status_val = "ELIGIBLE"
                    if not reason_str:
                        reason_str = f"Nợ {debt_cred} tín chỉ (< 10 TC) - Đủ điều kiện chuyển sang bước giao task đồ án"
                    eligible_count += 1
                else:
                    status_val = "INELIGIBLE"
                    if not reason_str:
                        reason_str = f"Nợ {debt_cred} tín chỉ (>= 10 TC theo quy định), chờ Ban Chủ nhiệm Khoa xét Force Approve hoặc Loại khỏi đợt"
                    ineligible_count += 1

                proj = getattr(student, "graduation_project", None)
                if proj:
                    proj.gpa_score = gpa
                    proj.debt_credits = debt_cred
                    proj.initial_eligibility = status_val
                    proj.ineligibility_reason = reason_str

                    # Nếu nợ < 10 tín chỉ: Cho phép chuyển sang bước giao task đồ án (IN_PROGRESS)
                    if is_eligible:
                        proj.status = "IN_PROGRESS"
                    else:
                        if proj.status == "IN_PROGRESS":
                            proj.status = "OUTLINE_APPROVED"

                    proj.save(update_fields=["gpa_score", "debt_credits", "initial_eligibility", "ineligibility_reason", "status"])

                    updated_projects.append({
                        "student_name": student.user.get_full_name(),
                        "registration_no": mssv,
                        "gpa": gpa,
                        "debt_credits": debt_cred,
                        "status": status_val,
                        "project_status": proj.status,
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
