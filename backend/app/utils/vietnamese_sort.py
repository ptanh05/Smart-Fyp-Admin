VIETNAMESE_CHARS = [
    'a', 'à', 'ả', 'ã', 'á', 'ạ',
    'ă', 'ằ', 'ẳ', 'ẵ', 'ắ', 'ặ',
    'â', 'ầ', 'ẩ', 'ẫ', 'ấ', 'ậ',
    'b', 'c', 'd', 'đ',
    'e', 'è', 'ẻ', 'ẽ', 'é', 'ẹ',
    'ê', 'ề', 'ể', 'ễ', 'ế', 'ệ',
    'f', 'g', 'h',
    'i', 'ì', 'ỉ', 'ĩ', 'í', 'ị',
    'j', 'k', 'l', 'm', 'n',
    'o', 'ò', 'ỏ', 'õ', 'ó', 'ọ',
    'ô', 'ồ', 'ổ', 'ỗ', 'ố', 'ộ',
    'ơ', 'ờ', 'ở', 'ỡ', 'ớ', 'ợ',
    'p', 'q', 'r', 's', 't',
    'u', 'ù', 'ủ', 'ũ', 'ú', 'ụ',
    'ư', 'ừ', 'ử', 'ữ', 'ứ', 'ự',
    'v', 'w', 'x',
    'y', 'ỳ', 'ỷ', 'ỹ', 'ý', 'ỵ',
    'z'
]

CHAR_TO_INT = {c: i for i, c in enumerate(VIETNAMESE_CHARS)}
CHAR_TO_INT.update({c.upper(): i for i, c in enumerate(VIETNAMESE_CHARS)})

def _to_sortable_string(s):
    res = []
    for char in s:
        if char in CHAR_TO_INT:
            res.append(f"{CHAR_TO_INT[char]:03d}")
        else:
            res.append(f"{0:03d}") if char == " " else res.append(f"{ord(char):03d}")
    return "-".join(res)

def get_vietnamese_sort_key(full_name):
    if not full_name:
        return ("", "")
    
    parts = full_name.strip().split()
    if not parts:
        return ("", "")
    
    if len(parts) == 1:
        return (_to_sortable_string(parts[0]), "")
    
    first_name = parts[-1]
    last_and_middle_name = " ".join(parts[:-1])
    
    return (_to_sortable_string(first_name), _to_sortable_string(last_and_middle_name))

def sort_by_vietnamese_name(item_list, key_extractor):
    """
    Sắp xếp danh sách dựa trên trường Tên Tiếng Việt.
    :param item_list: Danh sách các đối tượng hoặc dictionary.
    :param key_extractor: Hàm trích xuất chuỗi họ tên từ một item.
    """
    return sorted(item_list, key=lambda x: get_vietnamese_sort_key(key_extractor(x)))


import re

VIETNAMESE_SURNAMES = {
    'nguyễn', 'nguyen', 'trần', 'tran', 'lê', 'le', 'phạm', 'pham',
    'hoàng', 'hoang', 'huỳnh', 'huynh', 'phan', 'vũ', 'vu', 'võ', 'vo',
    'đặng', 'dang', 'bùi', 'bui', 'đỗ', 'do', 'hồ', 'ho', 'ngô', 'ngo',
    'dương', 'duong', 'đoàn', 'doan', 'đào', 'dao', 'đinh', 'dinh',
    'lâm', 'lam', 'phùng', 'phung', 'mai', 'tô', 'to', 'trịnh', 'trinh',
    'lý', 'ly', 'hà', 'ha', 'lương', 'luong', 'thái', 'thai', 'tạ', 'ta',
    'cao', 'chu', 'triệu', 'trieu', 'tiêu', 'tieu', 'kim', 'tống', 'tong',
    'thạch', 'thach', 'lưu', 'luu', 'nông', 'nong', 'quách', 'quach',
    'khưu', 'khuu', 'mạc', 'mac', 'bạch', 'bach', 'hứa', 'hua', 'kiều', 'kieu',
    'lại', 'lai', 'trang', 'liêu', 'lieu', 'vương', 'vuong', 'giáp', 'giap',
    'nghiêm', 'nghiem', 'tăng', 'tang', 'tôn', 'ton', 'la', 'cù', 'cu',
    'nham', 'nhâm', 'ông', 'ong', 'châu', 'chau', 'viên', 'vien', 'phí', 'phi', 'chế', 'che'
}

COMMON_GIVEN_OR_MIDDLE_NAMES = {
    'linh', 'văn', 'van', 'thị', 'thi', 'an', 'bình', 'binh', 'cường', 'cuong',
    'dũng', 'dung', 'đức', 'duc', 'hải', 'hai', 'hương', 'huong', 'huy',
    'khang', 'khánh', 'khanh', 'khoa', 'long', 'minh', 'nam', 'ngọc', 'ngoc',
    'phong', 'phương', 'phuong', 'quân', 'quan', 'quang', 'sơn', 'son',
    'thắng', 'thang', 'thanh', 'thảo', 'thao', 'thu', 'trang', 'trung',
    'tuấn', 'tuan', 'tùng', 'tung', 'anh', 'khải', 'khai', 'phúc', 'phuc',
    'ngân', 'ngan', 'hà', 'ha', 'bách', 'bach', 'tiến', 'tien', 'đạt', 'dat',
    'vy', 'nhi', 'nhung', 'bảo', 'bao', 'đăng', 'dang', 'luyên', 'luyen',
    'sao', 'thông', 'thong', 'thủy', 'thuy', 'duy', 'kiên', 'kien',
    'hậu', 'hau', 'hiếu', 'hieu', 'lâm', 'lam', 'mai', 'lan', 'hoa',
    'hồng', 'hong', 'nga', 'huyền', 'huyen', 'loan', 'hạnh', 'hanh',
    'hưng', 'hung', 'hoan', 'huấn', 'huan'
}

TITLE_REGEX = re.compile(
    r'^(pgs\s*\.?\s*ts\s*\.?|gs\s*\.?\s*ts\s*\.?|th\s*\.?\s*s\s*\.?|ths\s*\.?|ts\s*\.?|pgs\s*\.?|gs\s*\.?|dr\s*\.?|prof\s*\.?)\s*',
    re.IGNORECASE
)

def normalize_vietnamese_full_name(full_name: str) -> str:
    """
    Chuẩn hóa chuỗi họ tên người Việt (đưa họ bị đảo ra sau về đầu: Tên trước Họ sau -> Họ trước Tên sau).
    Ví dụ: 'Phương Vy Hồ' -> 'Hồ Phương Vy', 'TS Mạnh Dũng Lại' -> 'TS Lại Mạnh Dũng'
    """
    if not full_name:
        return ""
    trimmed = str(full_name).strip()
    if not trimmed:
        return ""

    title = ""
    rest = trimmed
    m = TITLE_REGEX.match(trimmed)
    if m:
        title = m.group(0)
        rest = trimmed[len(title):].strip()

    words = rest.split()
    if len(words) <= 1:
        return f"{title}{rest}".strip()

    first_word = words[0]
    last_word = words[-1]
    penultimate = words[-2] if len(words) >= 3 else None

    is_last_surname = last_word.lower() in VIETNAMESE_SURNAMES
    is_first_surname = first_word.lower() in VIETNAMESE_SURNAMES
    is_penultimate_given = penultimate.lower() in COMMON_GIVEN_OR_MIDDLE_NAMES if penultimate else False

    # Trường hợp 2 từ: "Linh Lý" -> "Lý Linh"
    if len(words) == 2 and is_last_surname and not is_first_surname:
        reordered = f"{last_word} {first_word}"
        return f"{title}{reordered}".strip()

    # Trường hợp 3 từ trở lên:
    if len(words) >= 3 and is_last_surname and is_penultimate_given:
        reordered = f"{last_word} " + " ".join(words[:-1])
        return f"{title}{reordered}".strip()

    if is_last_surname and not is_first_surname:
        reordered = f"{last_word} " + " ".join(words[:-1])
        return f"{title}{reordered}".strip()

    return f"{title}{rest}".strip()

def format_vietnamese_full_name(first_name: str, last_name: str, username_fallback: str = "") -> str:
    """
    Định dạng họ và tên theo quy ước tiếng Việt: Họ và đệm trước, Tên sau.
    """
    fn = (first_name or "").strip()
    ln = (last_name or "").strip()
    if not fn and not ln:
        return username_fallback.strip()
    if not fn:
        return normalize_vietnamese_full_name(ln)
    if not ln:
        return normalize_vietnamese_full_name(fn)

    fn_lower = fn.lower()
    ln_lower = ln.lower()
    if any(fn_lower.startswith(t) for t in ['ths', 'ts', 'pgs', 'gs']):
        return normalize_vietnamese_full_name(f"{fn} {ln}")
    if any(ln_lower.startswith(t) for t in ['ths', 'ts', 'pgs', 'gs']):
        return normalize_vietnamese_full_name(f"{ln} {fn}")

    fn_words = fn.split()
    ln_words = ln.split()

    fn_first_is_surname = fn_words[0].lower() in VIETNAMESE_SURNAMES
    ln_first_is_surname = ln_words[0].lower() in VIETNAMESE_SURNAMES

    # Nếu fn bắt đầu bằng họ và ln KHÔNG phải họ (vd: fn="Nguyễn Văn", ln="An")
    if fn_first_is_surname and not ln_first_is_surname:
        return normalize_vietnamese_full_name(f"{fn} {ln}")

    # Mặc định chuẩn tiếng Việt: ln (Họ) trước, fn (Tên) sau (vd: ln="Hồ", fn="Phương Vy" -> "Hồ Phương Vy")
    return normalize_vietnamese_full_name(f"{ln} {fn}")

