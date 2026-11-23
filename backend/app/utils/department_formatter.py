# -*- coding: utf-8 -*-
"""
Tien ich chuan hoa ten Bo mon chuyen mon UTC co dau chuan tieng Viet.
Khac phuc tinh trang "cho co dau cho khong"
(vi du: "Bo mon Cong nghe phan mem" -> "Bộ môn Công nghệ phần mềm")
"""
import unicodedata

DEPARTMENT_CANONICAL_MAP = {
    "CNPM": "Bộ môn Công nghệ phần mềm",
    "HTTT": "Bộ môn Hệ thống thông tin",
    "KHMT": "Bộ môn Khoa học máy tính & Mạng máy tính",
    "MMT": "Bộ môn Mạng máy tính & ATTT",
    "ATTT": "Bộ môn An toàn thông tin",
}

def remove_diacritics(text: str) -> str:
    if not text:
        return ""
    nfd = unicodedata.normalize("NFD", text)
    stripped = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return stripped.replace("đ", "d").replace("Đ", "D")

def normalize_department_name(department_name: str | None, department_code: str | None = None) -> str:
    """
    Chuan hoa chuoi ten bo mon sang tieng Viet chuan co dau.
    """
    code = (department_code or "").strip().upper()
    if code in DEPARTMENT_CANONICAL_MAP:
        return DEPARTMENT_CANONICAL_MAP[code]

    if not department_name or not str(department_name).strip():
        return "Khoa CNTT"

    raw = str(department_name).strip()
    raw_ascii = remove_diacritics(raw).lower()

    if "cong nghe phan mem" in raw_ascii or raw_ascii == "cnpm":
        return DEPARTMENT_CANONICAL_MAP["CNPM"]
    if "he thong thong tin" in raw_ascii or raw_ascii == "httt":
        return DEPARTMENT_CANONICAL_MAP["HTTT"]
    if "khoa hoc may tinh" in raw_ascii or raw_ascii == "khmt":
        return DEPARTMENT_CANONICAL_MAP["KHMT"]
    if "mang may tinh" in raw_ascii or "attt" in raw_ascii or "an toan thong tin" in raw_ascii or raw_ascii == "mmt":
        return DEPARTMENT_CANONICAL_MAP["MMT"]

    # Chuan hoa tien to "Bo mon " -> "Bộ môn " neu chuoi bat dau bang Bo mon
    if raw_ascii.startswith("bo mon "):
        idx = raw.lower().find("bo mon ")
        return "Bộ môn " + raw[idx + 7:].strip()

    return raw


def auto_heal_unaccented_departments():
    """
    Tu dong quet va cap nhat cac ban ghi Bo mon / Giang vien chua co dau trong DB sang chuan UTC co dau.
    """
    try:
        from app.models import Department, Supervisor, SupervisorQuota
        for d in Department.objects.all():
            norm = normalize_department_name(d.name, d.code)
            if d.name != norm:
                d.name = norm
                d.save(update_fields=["name"])

        for s in Supervisor.objects.all():
            code = s.department_obj.code if s.department_obj else None
            norm = normalize_department_name(s.department_name, code)
            if s.department_name != norm:
                s.department_name = norm
                s.save(update_fields=["department_name"])

        for q in SupervisorQuota.objects.all():
            norm = normalize_department_name(q.department)
            if q.department != norm:
                q.department = norm
                q.save(update_fields=["department"])
    except Exception:
        pass
