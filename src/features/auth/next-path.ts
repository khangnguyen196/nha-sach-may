// Đường dẫn quay lại sau đăng nhập / xác nhận email đến từ URL (?next=) → kẻ xấu đặt được. Chỉ nhận đường dẫn
// nội bộ để không thành open redirect: bắt đầu bằng một `/`, không `//` hay `\` (trình duyệt hiểu `/\x` thành
// `//x`), không ký tự điều khiển / khoảng trắng (trình duyệt bỏ tab, xuống dòng → `/\t/evil.com` thành `//evil.com`).
const BASE = 'http://internal.invalid'

export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  if (/[\x00-\x20\x7f]/.test(value)) return fallback

  const url = new URL(value, BASE)
  if (url.origin !== BASE) return fallback
  // Kiểm tra lại SAU khi URL() chuẩn hóa: `/..//evil.com`, `/%2e%2e//evil.com` thành `//evil.com`
  // (protocol-relative → redirect ra ngoài) dù đầu vào không bắt đầu bằng `//`
  const path = `${url.pathname}${url.search}`
  return path.startsWith('//') ? fallback : path
}

/**
 * Dự phòng khi input ẩn `next` (NextField điền ở client sau hydrate) còn trống lúc gửi: lấy `next` trong URL trang đăng
 * nhập (header Referer của chính lần POST đó). Nút gửi khóa tới khi hydrate (★8) nên tắt JS không gửi được; ca còn lại
 * là form không qua nút khóa (VD HTML cũ còn trong bộ đệm từ trước ★8). Kết quả vẫn phải qua safeNextPath.
 */
export function nextFromReferer(referer: string | null): string {
  if (!referer) return ''
  try {
    return new URL(referer).searchParams.get('next') ?? ''
  } catch {
    return ''
  }
}
