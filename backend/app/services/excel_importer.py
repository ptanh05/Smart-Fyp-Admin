import openpyxl
import re
from django.db import transaction
from django.contrib.auth import get_user_model
from app.models import CustomUser, Student, AcademicBatch, CourseClass

class ExcelImportService:
    @staticmethod
    def import_students_from_excel(file_obj, batch_id):
        """
        Import students and course classes from standard UTC portal Excel registration files.
        Supports multi-sheet class rosters (e.g. CNT04.101, IT1.243.102, IT1.659.103).
        """
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {
                "success": False,
                "error": f"AcademicBatch ID {batch_id} does not exist.",
                "total": 0,
                "created": 0,
                "updated": 0,
                "skipped": 0,
                "errors": []
            }

        wb = openpyxl.load_workbook(file_obj, data_only=True)
        total_count = 0
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []

        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            if ws.max_row < 2:
                continue

            # Check if sheet contains Course Class header (e.g. Row 6: "Học phần: Đồ án tốt nghiệp-1-1-26(N41).DA")
            class_code = sheet_name.strip()
            class_name = f"Lớp học phần {class_code}"
            class_group = ""
            program_type = "DAI_TRA"

            for r in range(1, min(10, ws.max_row + 1)):
                val = str(ws.cell(r, 1).value or "")
                if "Học phần:" in val:
                    class_name = val.replace("Học phần:", "").strip()
                    # extract group e.g. (N41)
                    match_grp = re.search(r'\((N\d+)\)', class_name)
                    if match_grp:
                        class_group = match_grp.group(1)
                    if "Việt - Anh" in class_name or "Việt Anh" in class_name:
                        program_type = "VIET_ANH"
                    elif "Khoa học máy tính" in class_name or "KHMT" in class_name:
                        program_type = "KHMT"
                    elif "Kỹ sư" in class_name:
                        program_type = "DAI_TRA"
                    break

            course_class, _ = CourseClass.objects.update_or_create(
                batch=batch,
                class_code=class_code,
                defaults={
                    "class_name": class_name,
                    "class_group": class_group,
                    "program_type": program_type
                }
            )

            # Find table header row (usually contains 'STT' or 'Mã số SV' or 'Mã sinh viên')
            header_row_idx = None
            col_mssv = None
            col_first_name = None
            col_last_name = None
            col_full_name = None
            col_class = None

            for r in range(1, min(15, ws.max_row + 1)):
                row_vals = [str(ws.cell(r, c).value or "").strip().lower() for c in range(1, ws.max_column + 1)]
                for c_idx, val in enumerate(row_vals, start=1):
                    if val in ["mã số sv", "mã sinh viên", "mssv"]:
                        header_row_idx = r
                        col_mssv = c_idx
                    elif val in ["họ và tên", "họ tên"]:
                        col_full_name = c_idx
                    elif val in ["họ và", "họ đệm", "họ"]:
                        col_last_name = c_idx
                    elif val in ["tên"]:
                        col_first_name = c_idx
                    elif val in ["lớp", "lớp sinh hoạt", "tên lớp"]:
                        col_class = c_idx

                if header_row_idx is not None:
                    break

            if header_row_idx is None:
                # If no standard header found, skip sheet
                continue

            # Process data rows
            for r in range(header_row_idx + 1, ws.max_row + 1):
                mssv_raw = ws.cell(r, col_mssv).value if col_mssv else None
                if not mssv_raw:
                    continue

                mssv = str(mssv_raw).strip()
                if not mssv or mssv.lower() in ["stt", "người lập", "cán bộ", "*"]:
                    continue

                # Parse name
                first_name = ""
                last_name = ""
                if col_last_name and col_first_name:
                    last_name = str(ws.cell(r, col_last_name).value or "").strip()
                    first_name = str(ws.cell(r, col_first_name).value or "").strip()
                elif col_full_name:
                    full = str(ws.cell(r, col_full_name).value or "").strip()
                    tokens = full.split()
                    if tokens:
                        first_name = tokens[-1]
                        last_name = " ".join(tokens[:-1])

                student_class_name = str(ws.cell(r, col_class).value or "").strip() if col_class else ""

                total_count += 1
                try:
                    with transaction.atomic():
                        # Create or update CustomUser
                        username = mssv
                        email = f"{mssv.lower()}@lms.utc.edu.vn"

                        user, user_created = CustomUser.objects.get_or_create(
                            username=username,
                            defaults={
                                "email": email,
                                "first_name": first_name,
                                "last_name": last_name,
                                "user_type": "student",
                                "is_staff": False
                            }
                        )

                        if user_created:
                            # Default password is MSSV (hashed securely)
                            user.set_password(mssv)
                            user.save()
                        else:
                            # Update names if empty
                            if not user.first_name and first_name:
                                user.first_name = first_name
                                user.last_name = last_name
                                user.save(update_fields=["first_name", "last_name"])

                        # Create or update Student profile
                        student, std_created = Student.objects.update_or_create(
                            user=user,
                            defaults={
                                "registration_no": mssv,
                                "department": student_class_name or course_class.class_name,
                                "course_class": course_class,
                                "academic_batch": batch,
                                "batch_no": student_class_name
                            }
                        )

                        if user_created or std_created:
                            created_count += 1
                        else:
                            updated_count += 1

                except Exception as ex:
                    errors.append(f"Sheet '{sheet_name}', Row {r}, MSSV {mssv}: {str(ex)}")
                    skipped_count += 1

        return {
            "success": True,
            "total": total_count,
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": errors
        }
