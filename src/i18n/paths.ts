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
