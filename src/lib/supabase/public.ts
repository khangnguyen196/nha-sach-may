import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { supabaseEnv } from './env'
import { createResilientFetch, retryPolicy } from './resilient-fetch'

/**
 * Client ẩn danh, không đọc cookies → dùng được trong 'use cache' cho dữ liệu catalog công khai.
 * Chạy với quyền anon nên RLS chỉ trả về dữ liệu đang hiển thị (is_active).
 * Chỉ đọc (kể cả RPC quote_items / search_books) → retry an toàn; client theo phiên (có mutation) không retry.
 * `retry: false` cho RPC anon có ghi (consume_chat_quota của chatbot): một lần thử, vẫn có timeout.
 */
export function createPublicClient({ retry = true }: { retry?: boolean } = {}) {
  const { url, publishableKey } = supabaseEnv()
  const policy = retryPolicy()
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createResilientFetch(retry ? policy : { ...policy, attempts: 1 }) },
  })
}
