import 'server-only'
import { io } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Client theo phiên cho query của trang admin. Supabase so hạn token với Date.now(): prerender theo phiên (prefetch App
 * Shell khi link admin hiện trên màn hình) gặp nó sẽ báo "unstable value Date.now()". io() dừng prerender ở đây; lúc
 * có request thật thì resolve ngay (như getCurrentUser trong lib/auth.ts).
 */
export async function createAdminQueryClient() {
  await io()
  return createClient()
}
