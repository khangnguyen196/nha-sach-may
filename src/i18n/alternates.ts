import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getPathname, type Href } from './navigation'
import { routing } from './routing'

/** canonical + hreflang của một trang: mỗi locale một URL, pathname đã dịch (/sach/x ↔ /en/books/x) */
export function localeAlternates(href: Href, locale: Locale): Metadata['alternates'] {
  return {
    canonical: getPathname({ href, locale }),
    languages: Object.fromEntries(routing.locales.map((target) => [target, getPathname({ href, locale: target })])),
  }
}
