/**
 * Tiện ích chuẩn hóa họ và tên theo quy ước tiếng Việt: Họ trước, Tên sau.
 * (Vietnamese naming convention: Surname / Family Name first, Middle & Given Name last)
 * 
 * Ví dụ:
 * - first_name = "Hà Linh", last_name = "Lý" -> "Lý Hà Linh"
 * - first_name = "Lý", last_name = "Hà Linh" -> "Lý Hà Linh"
 * - single string = "Hà Linh Lý" -> "Lý Hà Linh"
 * - single string = "Lý Hà Linh" -> "Lý Hà Linh" (giữ nguyên vì đã đúng chuẩn)
 * - first_name = "An", last_name = "Nguyễn Văn" -> "Nguyễn Văn An"
 * - first_name = "Vũ Bá", last_name = "Thắng" -> "Vũ Bá Thắng"
 * - first_name = "ThS. Nguyễn Thị", last_name = "Hồng (Giáo Vụ)" -> "ThS. Nguyễn Thị Hồng (Giáo Vụ)"
 * - first_name = "PGS.TS. Trần Thị", last_name = "Mai" -> "PGS.TS. Trần Thị Mai"
 */

export const VIETNAMESE_SURNAMES = new Set([
  'nguyễn', 'nguyen',
  'trần', 'tran',
  'lê', 'le',
  'phạm', 'pham',
  'hoàng', 'hoang',
  'huỳnh', 'huynh',
  'phan',
  'vũ', 'vu',
  'võ', 'vo',
  'đặng', 'dang',
  'bùi', 'bui',
  'đỗ', 'do',
  'hồ', 'ho',
  'ngô', 'ngo',
  'dương', 'duong',
  'đoàn', 'doan',
  'đào', 'dao',
  'đinh', 'dinh',
  'lâm', 'lam',
  'phùng', 'phung',
  'mai',
  'tô', 'to',
  'trịnh', 'trinh',
  'lý', 'ly',
  'hà', 'ha',
  'lương', 'luong',
  'thái', 'thai',
  'tạ', 'ta',
  'cao',
  'chu',
  'triệu', 'trieu',
  'tiêu', 'tieu',
  'kim',
  'tống', 'tong',
  'thạch', 'thach',
  'lưu', 'luu',
  'nông', 'nong',
  'quách', 'quach',
  'khưu', 'khuu',
  'mạc', 'mac',
  'bạch', 'bach',
  'hứa', 'hua',
  'kiều', 'kieu',
  'lại', 'lai',
  'trang',
  'liêu', 'lieu',
  'vương', 'vuong',
  'giáp', 'giap',
  'nghiêm', 'nghiem',
  'tăng', 'tang',
  'tôn', 'ton',
  'la',
  'cù', 'cu',
  'nham', 'nhâm',
  'ông', 'ong',
  'châu', 'chau',
  'viên', 'vien',
  'phí', 'phi',
  'chế', 'che',
]);

export const COMMON_GIVEN_OR_MIDDLE_NAMES = new Set([
  'linh', 'văn', 'van', 'thị', 'thi', 'an', 'bình', 'binh', 'cường', 'cuong',
  'dũng', 'dung', 'đức', 'duc', 'hải', 'hai', 'hương', 'huong', 'huy',
  'khang', 'khánh', 'khanh', 'khoa', 'long', 'minh', 'nam', 'ngọc', 'ngoc',
  'phong', 'phương', 'phuong', 'quân', 'quan', 'quang', 'sơn', 'son',
  'thắng', 'thang', 'thanh', 'thảo', 'thao', 'thu', 'trang', 'trung',
  'tuấn', 'tuan', 'tùng', 'tung', 'anh', 'khải', 'khai', 'phúc', 'phuc',
  'ngân', 'ngan', 'hà', 'ha', 'bách', 'bach', 'tiến', 'tien', 'đạt', 'dat'
]);

// Regex nhận diện học hàm, học vị ở đầu chuỗi (PGS.TS., GS.TS., ThS., TS., PGS., GS., Dr., Prof...)
const TITLE_REGEX = /^(pgs\s*\.?\s*ts\s*\.?|gs\s*\.?\s*ts\s*\.?|th\s*\.?\s*s\s*\.?|ths\s*\.?|ts\s*\.?|pgs\s*\.?|gs\s*\.?|dr\s*\.?|prof\s*\.?)\s*/i;

/**
 * Kiểm tra một từ có phải là họ người Việt hay không
 */
export function isVietnameseSurname(word: string): boolean {
  if (!word) return false;
  return VIETNAMESE_SURNAMES.has(word.trim().toLowerCase());
}

/**
 * Chuẩn hóa một chuỗi họ tên đơn lẻ nếu bị đảo ngược (Tên trước, Họ sau -> Họ trước, Tên sau)
 */
export function normalizeVietnameseFullName(fullName: string): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';

  // Tách học hàm/học vị nếu có ở đầu chuỗi (ví dụ "TS. Nguyễn Văn Minh", "PGS.TS. Hà Linh Lý")
  let title = '';
  let rest = trimmed;
  const titleMatch = trimmed.match(TITLE_REGEX);
  if (titleMatch) {
    title = titleMatch[0];
    rest = trimmed.substring(title.length).trim();
  }

  const nameWords = rest.split(/\s+/).filter(Boolean);
  if (nameWords.length <= 1) {
    return (title + rest).trim();
  }

  const firstWord = nameWords[0];
  const lastWord = nameWords[nameWords.length - 1];
  const penultimateWord = nameWords.length >= 3 ? nameWords[nameWords.length - 2] : null;

  const isLastSurname = isVietnameseSurname(lastWord);
  const isFirstSurname = isVietnameseSurname(firstWord);
  const isPenultimateGiven = penultimateWord ? COMMON_GIVEN_OR_MIDDLE_NAMES.has(penultimateWord.toLowerCase()) : false;

  // Trường hợp 2 từ: "Linh Lý" -> "Lý Linh"
  if (nameWords.length === 2 && isLastSurname && !isFirstSurname) {
    const reordered = [lastWord, firstWord].join(' ');
    return (title + reordered).trim();
  }

  // Trường hợp 3 từ trở lên:
  // Nếu từ cuối là Họ Việt Nam, và từ trước nó là tên gọi đặc trưng (ví dụ "Hà Linh Lý" -> "Lý Hà Linh", "Văn An Nguyễn" -> "Nguyễn Văn An")
  // Trong cấu trúc tiếng Việt, không bao giờ một họ đứng sau tên gọi trong tên đầy đủ.
  if (nameWords.length >= 3 && isLastSurname && isPenultimateGiven) {
    const reordered = [lastWord, ...nameWords.slice(0, -1)].join(' ');
    return (title + reordered).trim();
  }

  // Nếu từ cuối là họ Việt Nam và từ đầu tiên không phải họ
  if (isLastSurname && !isFirstSurname) {
    const reordered = [lastWord, ...nameWords.slice(0, -1)].join(' ');
    return (title + reordered).trim();
  }

  return (title + nameWords.join(' ')).trim();
}

export function formatFullName(
  firstNameOrUser?: { first_name?: string; last_name?: string; username?: string; full_name?: string } | string | null,
  lastName?: string | null,
  usernameFallback: string = ''
): string {
  if (!firstNameOrUser) {
    return normalizeVietnameseFullName(lastName || usernameFallback || '');
  }

  // Nếu tham số truyền vào là đối tượng user
  if (typeof firstNameOrUser === 'object') {
    const u = firstNameOrUser;
    if (u.full_name && typeof u.full_name === 'string' && u.full_name.trim()) {
      return normalizeVietnameseFullName(u.full_name.trim());
    }
    if (u.first_name || u.last_name) {
      return formatFullName(u.first_name, u.last_name, u.username || usernameFallback);
    }
    return normalizeVietnameseFullName(u.username || usernameFallback);
  }

  const fn = (firstNameOrUser || '').trim();
  const ln = (lastName || '').trim();

  if (!fn && !ln) return normalizeVietnameseFullName(usernameFallback.trim());
  if (!fn) return normalizeVietnameseFullName(ln);
  if (!ln) return normalizeVietnameseFullName(fn);

  // Kiểm tra học hàm, học vị (ThS, TS, PGS, GS...)
  if (TITLE_REGEX.test(fn)) {
    return `${fn} ${ln}`.trim();
  }
  if (TITLE_REGEX.test(ln)) {
    return `${ln} ${fn}`.trim();
  }

  const fnWords = fn.split(/\s+/).filter(Boolean);
  const lnWords = ln.split(/\s+/).filter(Boolean);

  // Phân tích họ:
  // Nếu last_name là 1 họ phổ biến của Việt Nam (ví dụ: "Lý", "Nguyễn", "Trần", "Lê", "Phạm",...):
  // Và first_name là tên gọi / tên đệm (ví dụ: "Hà Linh", "Văn An", "Thị Mai"):
  // => ĐÂY LÀ CHUẨN FORM QUỐC TẾ (First Name = Given Name, Last Name = Surname).
  // Chuẩn tiếng Việt bắt buộc phải đưa Họ (last_name) lên trước: `${ln} ${fn}` ("Lý Hà Linh")!
  if (isVietnameseSurname(lnWords[0]) && lnWords.length === 1) {
    return normalizeVietnameseFullName(`${ln} ${fn}`);
  }

  // Nếu first_name bắt đầu bằng họ tiếng Việt (ví dụ: "Nguyễn Văn", "Lý Hà", "Trần Thị") và last_name là tên:
  if (isVietnameseSurname(fnWords[0])) {
    return normalizeVietnameseFullName(`${fn} ${ln}`);
  }

  // Nếu last_name bắt đầu bằng họ tiếng Việt (ví dụ: "Nguyễn Văn", "Trần Thị"):
  if (isVietnameseSurname(lnWords[0])) {
    return normalizeVietnameseFullName(`${ln} ${fn}`);
  }

  // Nếu first_name có từ 2 từ trở lên và last_name là 1 từ:
  if (fnWords.length > 1 && lnWords.length === 1) {
    return normalizeVietnameseFullName(`${fn} ${ln}`);
  }

  // Mặc định chuẩn tiếng Việt: last_name (Họ và đệm) đứng trước, first_name (Tên) đứng sau
  return normalizeVietnameseFullName(`${ln} ${fn}`);
}
