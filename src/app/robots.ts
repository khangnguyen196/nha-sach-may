import type { MetadataRoute } from 'next'
import { localizedPath } from '@/i18n/paths'
import { routing } from '@/i18n/routing'
import { siteUrl } from '@/lib/site-url'

// Trang riêng tư / theo phiên: đã noindex, chặn thêm ở robots để bot không tốn lượt crawl
const PRIVATE = ['/cart', '/checkout', '/account', '/login', '/register', '/forgot-password', '/reset-password', '/confirm'] as const

export default function robots(): MetadataRoute.Robots {
  const disallow = ['/admin', '/api/', ...routing.locales.flatMap((locale) => PRIVATE.map((path) => localizedPath(path, locale)))]
  return { rules: { userAgent: '*', allow: '/', disallow }, sitemap: `${siteUrl()}/sitemap.xml` }
}
