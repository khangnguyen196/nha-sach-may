// Trang không có bong bóng chat (pathname nội bộ của next-intl, VD '/checkout', '/checkout/success/[code]'):
// thanh toán cần khách tập trung, không che nút đặt hàng.
const HIDDEN_PREFIXES = ['/checkout']

export function isChatHidden(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/** Slug sách đang xem (trang /books/[slug]) để Mây trả lời về cuốn đó; trang khác → null */
export function currentBookSlug(pathname: string, params: Record<string, string | string[] | undefined>): string | null {
  // next-intl trả pathname nội bộ dạng mẫu ('/books/[slug]') khi có cấu hình pathnames; nhận cả dạng đã điền slug
  if (pathname !== '/books/[slug]' && !/^\/books\/[^/]+$/.test(pathname)) return null
  const slug = params.slug
  return typeof slug === 'string' && slug ? slug : null
}
