import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { supabaseEnv } from './env'

/**
 * Client ẩn danh, không đọc cookies → dùng được trong 'use cache' cho dữ liệu catalog công khai.
 * Chạy với quyền anon nên RLS chỉ trả về dữ liệu đang hiển thị (is_active).
 */
export function createPublicClient() {
  const { url, publishableKey } = supabaseEnv()
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
