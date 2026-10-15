/**
 * URL gốc của site (không có `/` cuối) cho link tuyệt đối: email, sitemap, metadataBase. Thứ tự: `SITE_URL` (domain
 * thật), `VERCEL_PROJECT_PRODUCTION_URL` (Vercel tự đặt, không có giao thức), rồi máy dev. Chỉ dùng ở server.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`
  return 'http://localhost:3000'
}
