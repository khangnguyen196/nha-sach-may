// Đường dẫn quay lại sau đăng nhập / xác nhận email đến từ URL (?next=) → kẻ xấu đặt được. Chỉ nhận đường dẫn
// nội bộ để không thành open redirect: bắt đầu bằng một `/`, không `//` hay `\` (trình duyệt hiểu `/\x` thành
// `//x`), không ký tự điều khiển / khoảng trắng (trình duyệt bỏ tab, xuống dòng → `/\t/evil.com` thành `//evil.com`).
const BASE = 'http://internal.invalid'

export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  if (/[\u0000- \u007f]/.test(value)) return fallback

  const url = new URL(value, BASE)
  if (url.origin !== BASE) return fallback
  return `${url.pathname}${url.search}`
}
