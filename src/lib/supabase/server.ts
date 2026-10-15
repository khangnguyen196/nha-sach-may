import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { supabaseEnv } from './env'
import { FAULT_COOKIE, faultInjectedFetch } from './fault-injection'

/** Client theo phiên đăng nhập (đọc cookies) → chỉ gọi bên trong <Suspense>, không dùng trong 'use cache' */
export async function createClient() {
  const { url, publishableKey } = supabaseEnv()
  const cookieStore = await cookies()
  const faultyFetch = faultInjectedFetch(cookieStore.get(FAULT_COOKIE)?.value)

  return createServerClient<Database>(url, publishableKey, {
    ...(faultyFetch && { global: { fetch: faultyFetch } }),
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options)
        } catch {
          // Server Component không được ghi cookie; proxy đã refresh phiên trước khi render
        }
      },
    },
  })
}
