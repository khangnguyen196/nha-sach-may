import type { Locale } from 'next-intl'
import { routing } from './routing'

type StaticPathname = Exclude<keyof typeof routing.pathnames, `${string}[${string}]`>

/**
 * URL hiển thị của một trang tĩnh theo locale (/dang-nhap, /en/login), tính thẳng từ routing.
 * Cho proxy và Route Handler: getPathname của i18n/navigation kéo theo i18n/request.ts (next/root-params),
 * module này không build được ở hai nơi đó. Trong page / Server Action vẫn dùng getPathname.
 */
export function localizedPath(pathname: StaticPathname, locale: Locale, query?: Record<string, string>) {
  const entry = routing.pathnames[pathname]
  const path = typeof entry === 'string' ? entry : entry[locale]
  const prefixed = locale === routing.defaultLocale ? path : `/${locale}${path === '/' ? '' : path}`
  return query ? `${prefixed}?${new URLSearchParams(query)}` : prefixed
}

export type SlugPathname = '/books/[slug]' | '/categories/[slug]' | '/authors/[slug]'
type OrderPathname = '/checkout/success/[code]' | '/account/orders/[code]'
type ParamPathname = SlugPathname | OrderPathname | '/account/addresses/[id]' | '/used-books/[id]'

/** URL hiển thị của trang có một tham số động ([slug], [code]) theo locale */
function localizedParamPath(pathname: ParamPathname, value: string, locale: Locale) {
  const path = routing.pathnames[pathname][locale].replace(/\[[a-z]+\]/, encodeURIComponent(value))
  return locale === routing.defaultLocale ? path : `/${locale}${path}`
}

/** URL hiển thị của trang sách / danh mục / tác giả (/sach/x, /en/books/x) cho sitemap, proxy, JSON-LD */
export function localizedSlugPath(pathname: SlugPathname, slug: string, locale: Locale) {
  return localizedParamPath(pathname, slug, locale)
}

/** Chỉ khớp đúng một đoạn sau tiền tố (đã giải mã); chuỗi % hỏng → null */
function matchParamPath<K extends ParamPathname>(pathname: string, kinds: readonly K[]) {
  for (const locale of routing.locales) {
    for (const kind of kinds) {
      const prefix = localizedParamPath(kind, '', locale)
      if (!pathname.startsWith(prefix)) continue
      const rest = pathname.slice(prefix.length)
      if (!rest || rest.includes('/')) continue
      try {
        return { kind, value: decodeURIComponent(rest), locale }
      } catch {
        return null
      }
    }
  }
  return null
}

const SLUG_PATHNAMES: SlugPathname[] = ['/books/[slug]', '/categories/[slug]', '/authors/[slug]']

/**
 * Đường dẫn đang mở có phải trang sách / danh mục / tác giả không (theo URL đã dịch, cả hai locale) → loại trang,
 * slug (đã giải mã), locale. Chỉ khớp đúng một đoạn sau tiền tố: `/sach` (tất cả sách) và `/sach/a/b` không khớp.
 */
export function matchSlugPath(pathname: string): { kind: SlugPathname; slug: string; locale: Locale } | null {
  const match = matchParamPath(pathname, SLUG_PATHNAMES)
  return match && { kind: match.kind, slug: match.value, locale: match.locale }
}

/** Trang một đơn hàng (đặt hàng thành công, chi tiết đơn) → mã đơn (chưa kiểm định dạng), locale */
export function matchOrderPath(pathname: string): { code: string; locale: Locale } | null {
  const match = matchParamPath(pathname, ['/checkout/success/[code]', '/account/orders/[code]'] as const)
  return match && { code: match.value, locale: match.locale }
}

/**
 * Trang sửa một địa chỉ → id (chưa kiểm định dạng), locale. Trang thêm địa chỉ (/tai-khoan/dia-chi/moi) cùng tiền tố
 * nhưng không phải trang này.
 */
export function matchAddressPath(pathname: string): { id: string; locale: Locale } | null {
  const match = matchParamPath(pathname, ['/account/addresses/[id]'] as const)
  if (!match || pathname === localizedPath('/account/addresses/new', match.locale)) return null
  return { id: match.value, locale: match.locale }
}

/**
 * Trang một tin trên Chợ sách cũ (/cho-sach-cu/<id>, /en/used-books/<id>) → id (chưa kiểm định dạng), locale. Danh sách
 * (/cho-sach-cu) và trang con của tin (/cho-sach-cu/<id>/mua ở P-C) không khớp.
 */
export function matchUsedListingPath(pathname: string): { id: string; locale: Locale } | null {
  const match = matchParamPath(pathname, ['/used-books/[id]'] as const)
  return match && { id: match.value, locale: match.locale }
}
