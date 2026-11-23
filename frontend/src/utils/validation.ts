/**
 * Validation utility functions for form inputs in Smart-Fyp-Admin.
 */

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const cleanPhoneNumber = (phone: string | undefined | null): string => {
  if (!phone) return '';
  let cleaned = phone.trim().replace(/[\s.\-()]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
};

export const isValidPhoneNumber = (phone: string | undefined | null): boolean => {
  if (!phone) return false;
  const cleaned = cleanPhoneNumber(phone);
  return /^0[35789]\d{8}$/.test(cleaned);
};

export const validatePhoneNumber = (phone: string | undefined | null, isRequired: boolean = false): string | undefined => {
  const raw = (phone || '').trim();
  if (!raw) {
    return isRequired ? 'Vui lòng nhập số điện thoại' : undefined;
  }
  const cleaned = cleanPhoneNumber(raw);
  if (!/^\+?\d+$/.test(raw.replace(/[\s.\-()]/g, ''))) {
    return 'Số điện thoại chỉ được chứa chữ số';
  }
  if (!cleaned.startsWith('0')) {
    return 'Số điện thoại phải bắt đầu bằng số 0 (hoặc +84)';
  }
  if (cleaned.length < 10) {
    return `Số điện thoại chưa đủ 10 chữ số (hiện có ${cleaned.length} số)`;
  }
  if (cleaned.length > 10) {
    return `Số điện thoại vượt quá 10 chữ số (hiện có ${cleaned.length} số)`;
  }
  if (!/^0[35789]\d{8}$/.test(cleaned)) {
    return 'Đầu số không hợp lệ. Đầu số di động Việt Nam gồm: 03, 05, 07, 08, 09';
  }
  return undefined;
};
