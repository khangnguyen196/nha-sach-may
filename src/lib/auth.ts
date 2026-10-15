import 'server-only'
import { io } from 'next/cache'
import type { Locale } from 'next-intl'
import { cache } from 'react'
import { getPathname, redirect, type Href } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'

export type CurrentUser = { id: string; email: string; fullName: string | null }

/**
 * Người đang đăng nhập, hoặc null. Đọc cookies → chỉ gọi trong <Suspense>. `React.cache`: header, page và
 * generateMetadata trong cùng request dùng chung một lần kiểm tra.
 * getClaims() xác thực chữ ký JWT; không dùng getSession() ở server (đọc cookie mà không xác thực).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // getClaims so hạn token với Date.now(): prerender theo phiên (prefetch App Shell) gặp nó sẽ báo lỗi
  // "unstable value Date.now()". io() dừng prerender ở đây; lúc có request thật thì resolve ngay.
  await io()
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims) return null

  const fullName: unknown = claims.user_metadata?.full_name
  return {
    id: claims.sub,
    email: claims.email ?? '',
    fullName: typeof fullName === 'string' && fullName.trim() ? fullName.trim() : null,
  }
})

/**
 * Trang cần đăng nhập: chưa có phiên → trang đăng nhập kèm ?next= về đúng trang này.
 * Proxy đã chặn một lớp; kiểm tra lại ở server vì không chỉ dựa vào proxy (như /admin).
 */
export async function requireUser(locale: Locale, href: Href): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (user) return user
  return redirect({ href: { pathname: '/login', query: { next: getPathname({ href, locale }) } }, locale })
}
