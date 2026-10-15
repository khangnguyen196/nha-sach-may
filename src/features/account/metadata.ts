import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { localeAlternates } from '@/i18n/alternates'
import type { Href } from '@/i18n/navigation'

/** Trang tài khoản: riêng tư, không vào chỉ mục */
export async function accountPageMetadata(title: string, href: Href): Promise<Metadata> {
  const locale = await getLocale()
  return { title, robots: { index: false, follow: false }, alternates: localeAlternates(href, locale) }
}
