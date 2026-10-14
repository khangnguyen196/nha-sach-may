import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { supabaseEnv } from './env'

export function createClient() {
  const { url, publishableKey } = supabaseEnv()
  return createBrowserClient<Database>(url, publishableKey)
}
