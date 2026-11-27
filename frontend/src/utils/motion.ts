import React, { useLayoutEffect, useRef } from 'react';

/**
 * Phát lại một animation CSS (mặc định `m-page`) trên phần tử mỗi khi `dep` đổi,
 * KHÔNG remount component (tránh gọi lại API / mất state như khi đổi `key`).
 * File này giống hệt nhau ở cả 2 repo frontend.
 */
export function useReplayAnimation<T extends HTMLElement = HTMLDivElement>(
  dep: unknown,
  className = 'm-page'
) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      el.classList.add(className);
      return;
    }
    el.classList.remove(className);
    void el.offsetWidth; // ép trình duyệt reflow để animation chạy lại
    el.classList.add(className);
  }, [dep, className]);
  return ref;
}

/**
 * Bọc một nhãn trạng thái: chỉ khi `value` THỰC SỰ đổi (VD: Bản nháp -> Chờ Khoa
 * duyệt) mới phát hiệu ứng nảy + lóe sáng. Lần hiển thị đầu không chạy hiệu ứng.
 */
export function PopOnChange({ value, children }: { value: unknown; children?: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prev.current === value) return;
    prev.current = value;
    el.classList.remove('m-pop');
    void el.offsetWidth;
    el.classList.add('m-pop');
  }, [value]);
  return React.createElement('span', { ref, className: 'm-pop-host' }, children);
}
