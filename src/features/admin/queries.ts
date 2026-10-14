import 'server-only'
import { redirect } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'

/** Chặn người không phải admin. Đọc cookies → chỉ gọi trong <Suspense>. */
export async function requireAdmin() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_admin')
  if (error || data !== true) redirect({ href: '/', locale: 'vi' })
}
