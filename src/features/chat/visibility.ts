// Trang không có bong bóng chat (pathname nội bộ của next-intl, VD '/checkout', '/checkout/success/[code]'):
// thanh toán cần khách tập trung, không che nút đặt hàng. Trang mua sách cũ ('/used-books/[id]/buy') cũng là trang
// thanh toán (một tin); trang tin '/used-books/[id]' vẫn có bong bóng.
const HIDDEN_PREFIXES = ['/checkout']
/** next-intl trả pathname mẫu ('/used-books/[id]/buy') hoặc đã điền id → khớp cả hai */
const HIDDEN_PATTERNS = [/^\/used-books\/[^/]+\/buy$/]

export function isChatHidden(pathname: string): boolean {
  return (
    HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    HIDDEN_PATTERNS.some((pattern) => pattern.test(pathname))
  )
}

/** Slug sách đang xem (trang /books/[slug]) để Mây trả lời về cuốn đó; trang khác → null */
export function currentBookSlug(pathname: string, params: Record<string, string | string[] | undefined>): string | null {
  // next-intl trả pathname nội bộ dạng mẫu ('/books/[slug]') khi có cấu hình pathnames; nhận cả dạng đã điền slug
  if (pathname !== '/books/[slug]' && !/^\/books\/[^/]+$/.test(pathname)) return null
  const slug = params.slug
  return typeof slug === 'string' && slug ? slug : null
}
