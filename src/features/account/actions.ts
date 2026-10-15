'use server'

import { refresh } from 'next/cache'
import type { Locale } from 'next-intl'
import { redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import { invalidInput, toFailure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { parseLocale } from '@/features/auth/schemas'
import { addressIdSchema, addressReturnToSchema, addressSchema, emailLocaleSchema, type AddressReturnTo } from './schemas'

// locale / id do page bind sẵn (`createAddress.bind(null, locale)`): Server Action không đọc được
// next/root-params. Tham số bind đi qua client nên vẫn parse lại.
// user_id không bao giờ nhận từ client: lấy từ phiên; RLS `with check` chặn thêm một lớp.

/** `returnTo` = 'checkout': lưu xong quay lại thanh toán với địa chỉ mới được chọn sẵn */
export async function createAddress(
  locale: Locale,
  returnTo: AddressReturnTo,
  _prev: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = addressSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)
  const user = await getCurrentUser()
  if (!user) return { ok: false, code: 'AUTH_REQUIRED' }

  const supabase = await createClient()
  const { count, error: countError } = await supabase.from('addresses').select('id', { count: 'exact', head: true })
  if (countError) return toFailure(countError)

  // Địa chỉ đầu tiên tự thành mặc định
  const { data, error } = await supabase
    .from('addresses')
    .insert({ ...parsed.data, user_id: user.id, is_default: count === 0 })
    .select('id')
    .single()
  if (error) return toFailure(error)

  const target = addressReturnToSchema.parse(returnTo)
  return redirect({
    href: target === 'checkout' ? { pathname: '/checkout', query: { address: String(data.id) } } : '/account/addresses',
    locale: parseLocale(locale),
  })
}

export async function updateAddress(
  locale: Locale,
  id: number,
  _prev: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const addressId = addressIdSchema.safeParse(id)
  if (!addressId.success) return { ok: false, code: 'INVALID_ADDRESS' }
  const parsed = addressSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)
  if (!(await getCurrentUser())) return { ok: false, code: 'AUTH_REQUIRED' }

  const supabase = await createClient()
  const { data, error } = await supabase.from('addresses').update(parsed.data).eq('id', addressId.data).select('id')
  if (error) return toFailure(error)
  // RLS lọc mất dòng của người khác → 0 dòng được sửa
  if (data.length === 0) return { ok: false, code: 'INVALID_ADDRESS' }

  return redirect({ href: '/account/addresses', locale: parseLocale(locale) })
}

// Hai action dưới gắn vào nút trong danh sách (form không có state hiển thị lỗi): lỗi chỉ ghi log,
// danh sách được render lại nên người dùng thấy trạng thái thật.

export async function deleteAddress(id: number) {
  const addressId = addressIdSchema.safeParse(id)
  if (!addressId.success || !(await getCurrentUser())) return

  const supabase = await createClient()
  const { data, error } = await supabase.from('addresses').delete().eq('id', addressId.data).select('is_default')
  if (error) {
    console.error('deleteAddress:', error.message)
    return
  }

  // Xóa địa chỉ mặc định → địa chỉ mới nhất còn lại thành mặc định
  if (data[0]?.is_default) {
    const { data: newest } = await supabase
      .from('addresses')
      .select('id')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (newest) {
      const { error: rpcError } = await supabase.rpc('set_default_address', { p_address_id: newest.id })
      if (rpcError) console.error('deleteAddress → set_default_address:', rpcError.message)
    }
  }
  refresh()
}

export async function setDefaultAddress(id: number) {
  const addressId = addressIdSchema.safeParse(id)
  if (!addressId.success || !(await getCurrentUser())) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_default_address', { p_address_id: addressId.data })
  if (error) console.error('setDefaultAddress:', error.message)
  refresh()
}

/** Ngôn ngữ email (profiles.locale), độc lập với ngôn ngữ đang xem trang */
export async function updateEmailLocale(_prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const parsed = emailLocaleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)
  const user = await getCurrentUser()
  if (!user) return { ok: false, code: 'AUTH_REQUIRED' }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ locale: parsed.data.locale }).eq('id', user.id)
  if (error) return toFailure(error)
  return { ok: true, data: null }
}
