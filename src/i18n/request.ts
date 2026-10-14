import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { locale as rootLocale } from 'next/root-params'
import { formats } from './formats'
import { routing } from './routing'

// Lấy locale từ root param [locale] thay vì header của proxy: không đọc request nên trang vẫn
// prerender được, và gọi được trong 'use cache' (locale tự vào cache key).
// /admin không có [locale] → rootLocale() là undefined → tiếng Việt.
export default getRequestConfig(async ({ locale: explicit }) => {
  const requested = explicit ?? (await rootLocale())
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    formats,
    timeZone: 'Asia/Ho_Chi_Minh',
  }
})
