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
