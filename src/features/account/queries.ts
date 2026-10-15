import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Dữ liệu theo user: client theo phiên (cookies), không 'use cache'. RLS chỉ trả dòng của người đang đăng nhập.
// Chỉ gọi trong <Suspense>.

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('profiles').select('full_name, locale').eq('id', userId).maybeSingle()
  if (error) throw new Error(`getProfile: ${error.message}`)
  return data
})

const ADDRESS_COLUMNS = 'id, recipient_name, phone, province, ward, street, is_default'

/** Địa chỉ mặc định lên đầu, còn lại mới nhất trước */
export async function getAddresses() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('addresses')
    .select(ADDRESS_COLUMNS)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw new Error(`getAddresses: ${error.message}`)
  return data
}

export type Address = Awaited<ReturnType<typeof getAddresses>>[number]

export async function getAddress(id: number) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('addresses').select(ADDRESS_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(`getAddress: ${error.message}`)
  return data
}
