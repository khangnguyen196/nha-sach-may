import 'server-only'
import { cache } from 'react'
import { redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import type { Failure } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'

/**
 * Phiên hiện tại có phải admin không. Đọc cookies → chỉ gọi trong <Suspense> hoặc Server Action.
 * `React.cache`: layout và page trong cùng request dùng chung một lần gọi.
 */
export const isAdmin = cache(async (): Promise<boolean> => {
  if (!(await getCurrentUser())) return false
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_admin')
  return !error && data === true
})

/** Trang admin: không phải admin → về trang chủ (layout gọi; proxy đã chặn một lớp) */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect({ href: '/', locale: 'vi' })
}

/**
 * Câu lệnh đầu tiên của MỌI Server Action admin: `const denied = await assertAdmin(); if (denied) return denied`
 * (test tĩnh `actions.test.ts` kiểm tra). Server Action là endpoint POST gọi thẳng được bằng action ID từ bất kỳ
 * đường dẫn nào, không đi qua layout hay nhánh /admin của proxy.
 */
export async function assertAdmin(): Promise<Failure | null> {
  return (await isAdmin()) ? null : { ok: false, code: 'FORBIDDEN' }
}
