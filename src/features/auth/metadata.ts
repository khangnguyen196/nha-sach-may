import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { localeAlternates } from '@/i18n/alternates'
import type { Href } from '@/i18n/navigation'

type Page = 'login' | 'register' | 'forgot' | 'reset' | 'confirm'

const HREFS = {
  login: '/login',
  register: '/register',
  forgot: '/forgot-password',
  reset: '/reset-password',
  confirm: '/confirm',
} satisfies Record<Page, Href>

/** Trang đăng nhập / tài khoản không cần vào chỉ mục tìm kiếm */
export async function authPageMetadata(page: Page): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('auth'), getLocale()])
  return {
    title: t(`${page}.title`),
    robots: { index: false, follow: false },
    alternates: localeAlternates(HREFS[page], locale),
  }
}
