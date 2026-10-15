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

/** URL hiển thị của trang sách / danh mục / tác giả (/sach/x, /en/books/x) cho sitemap, proxy, JSON-LD */
export function localizedSlugPath(pathname: SlugPathname, slug: string, locale: Locale) {
  const path = routing.pathnames[pathname][locale].replace('[slug]', encodeURIComponent(slug))
  return locale === routing.defaultLocale ? path : `/${locale}${path}`
}

const SLUG_PATHNAMES: SlugPathname[] = ['/books/[slug]', '/categories/[slug]', '/authors/[slug]']

/**
 * Đường dẫn đang mở có phải trang sách / danh mục / tác giả không (theo URL đã dịch, cả hai locale) → loại trang,
 * slug (đã giải mã), locale. Chỉ khớp đúng một đoạn sau tiền tố: `/sach` (tất cả sách) và `/sach/a/b` không khớp.
 */
export function matchSlugPath(pathname: string): { kind: SlugPathname; slug: string; locale: Locale } | null {
  for (const locale of routing.locales) {
    for (const kind of SLUG_PATHNAMES) {
      const prefix = localizedSlugPath(kind, '', locale)
      if (!pathname.startsWith(prefix)) continue
      const rest = pathname.slice(prefix.length)
      if (!rest || rest.includes('/')) continue
      try {
        return { kind, slug: decodeURIComponent(rest), locale }
      } catch {
        return null
      }
    }
  }
  return null
}
