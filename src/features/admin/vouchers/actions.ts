'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { invalidInput, toFailure, type Failure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '../auth'
import { violatedUniqueConstraint } from '../db-errors'
import { rowIdSchema } from '../schemas'
import { voucherFormSchema } from './schemas'

// id do page bind sẵn; tham số bind đi qua client nên parse lại. Câu đầu mọi action là assertAdmin.
// Voucher không nằm trong cache catalog (khách kiểm tra mã qua quote_order / place_order theo request) → không updateTag.

const UNKNOWN: Failure = { ok: false, code: 'UNKNOWN' }

function voucherWriteFailure(error: { code?: string; message: string }): Failure {
  if (violatedUniqueConstraint(error) === 'vouchers_code_key') {
    return { ok: false, code: 'VOUCHER_CODE_TAKEN', fieldErrors: { code: 'voucherCodeTaken' } }
  }
  console.error('admin voucher write:', error.message)
  return toFailure(error)
}

export async function createVoucher(_prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const parsed = voucherFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.from('vouchers').insert(parsed.data)
  if (error) return voucherWriteFailure(error)
  redirect('/admin/voucher')
}

/** Đổi mức giảm / mã không ảnh hưởng đơn cũ: đơn lưu bản sao `voucher_code` và số tiền `discount` lúc đặt */
export async function updateVoucher(id: number, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const voucherId = rowIdSchema.safeParse(id)
  if (!voucherId.success) return UNKNOWN
  const parsed = voucherFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const supabase = await createClient()
  const { data, error } = await supabase.from('vouchers').update(parsed.data).eq('id', voucherId.data).select('id')
  if (error) return voucherWriteFailure(error)
  if (data.length === 0) return UNKNOWN
  refresh()
  return { ok: true, data: null }
}

/**
 * Chỉ xóa voucher chưa có đơn nào gắn mã (kể cả đơn đã hủy: used_count về 0 nhưng đơn vẫn trỏ tới); đã dùng thì chỉ
 * tắt. Đếm rồi xóa không cùng transaction: đơn đặt đúng lúc đó mất liên kết voucher_id (on delete set null) nhưng vẫn
 * giữ voucher_code và discount → chấp nhận.
 */
export async function deleteVoucher(id: number): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const voucherId = rowIdSchema.safeParse(id)
  if (!voucherId.success) return UNKNOWN

  const supabase = await createClient()
  const [voucher, orders] = await Promise.all([
    supabase.from('vouchers').select('used_count').eq('id', voucherId.data).maybeSingle(),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('voucher_id', voucherId.data),
  ])
  if (voucher.error) return toFailure(voucher.error)
  if (orders.error) return toFailure(orders.error)
  if (!voucher.data) return UNKNOWN
  if (voucher.data.used_count > 0 || (orders.count ?? 0) > 0) return { ok: false, code: 'VOUCHER_IN_USE' }

  const { error } = await supabase.from('vouchers').delete().eq('id', voucherId.data)
  if (error) return toFailure(error)
  redirect('/admin/voucher')
}
