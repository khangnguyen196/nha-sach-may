import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type CurrentUser = { id: string; email: string; fullName: string | null }

/**
 * Người đang đăng nhập, hoặc null. Đọc cookies → chỉ gọi trong <Suspense>. `React.cache`: header, page và
 * generateMetadata trong cùng request dùng chung một lần kiểm tra.
 * getClaims() xác thực chữ ký JWT; không dùng getSession() ở server (đọc cookie mà không xác thực).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
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
