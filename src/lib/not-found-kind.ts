// Proxy rewrite 404 kèm loại trang thiếu (header của request, chỉ proxy đặt; header khách tự gửi bị proxy bỏ, trừ đường
// dẫn proxy không chạy, xem withoutClientNotFoundKind) → not-found.tsx giải thích đúng chuyện:
// sách ngừng bán, danh mục đang ẩn, đơn của tài khoản khác… File không import gì: proxy dùng được.
export const NOT_FOUND_KINDS = ['page', 'book', 'category', 'author', 'order', 'address'] as const
export type NotFoundKind = (typeof NOT_FOUND_KINDS)[number]

export const NOT_FOUND_HEADER = 'x-not-found'

/** Giá trị header → loại trang; lạ / không có → trang chung */
export function parseNotFoundKind(value: string | null | undefined): NotFoundKind {
  return NOT_FOUND_KINDS.find((kind) => kind === value) ?? 'page'
}
