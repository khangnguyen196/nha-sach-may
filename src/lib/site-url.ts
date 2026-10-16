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

/**
 * Origin của request (header `Origin` mà trình duyệt gửi kèm POST của Server Action): link trong email quay về đúng
 * domain đang dùng (localhost, preview Vercel, production). Không có / không hợp lệ → siteUrl(). Supabase vẫn chỉ nhận
 * redirect nằm trong Redirect URLs của project, nên header giả cũng không đưa được người dùng ra domain lạ.
 */
export function requestOrigin(origin: string | null, env: Record<string, string | undefined> = process.env): string {
  if (origin) {
    try {
      const url = new URL(origin)
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin
    } catch {
      /* header lạ → dùng siteUrl */
    }
  }
  return siteUrl(env)
}
