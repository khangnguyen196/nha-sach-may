'use server'

import { refresh } from 'next/cache'
import { after } from 'next/server'
import { expireOrderBooks } from '@/features/orders/cache'
import { notifyOrder } from '@/features/orders/emails'
import { invalidInput, toFailure, type Failure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '../auth'
import { rowIdSchema } from '../schemas'
import { adminCancelOrderSchema, orderStatusSchema } from './schemas'
import { canAdminCancel, forwardStatus } from './status'

// id và trạng thái đang hiển thị do page bind sẵn; tham số bind đi qua client nên parse lại. Câu đầu mọi action là
// assertAdmin. Luồng trạng thái do trigger chặn ở DB; ở đây chỉ chọn bước kế tiếp từ trạng thái admin đang thấy.
// Update có điều kiện `status = <trạng thái đang hiển thị>`: khách vừa tự hủy / tab khác vừa đổi → 0 dòng →
// ORDER_STATUS_CHANGED + refresh() (trang hiện trạng thái thật), không ghi đè lên thay đổi đó.

const UNKNOWN: Failure = { ok: false, code: 'UNKNOWN' }
const STATUS_CHANGED: Failure = { ok: false, code: 'ORDER_STATUS_CHANGED' }

/** Chuyển đơn sang bước kế tiếp của luồng giao: chờ xác nhận → đã xác nhận → đang giao → đã giao */
export async function advanceOrder(id: number, shownStatus: string): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const orderId = rowIdSchema.safeParse(id)
  const from = orderStatusSchema.safeParse(shownStatus)
  if (!orderId.success || !from.success) return UNKNOWN
  const to = forwardStatus(from.data)
  if (!to) return STATUS_CHANGED

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .update({ status: to })
    .eq('id', orderId.data)
    .eq('status', from.data)
    .select('id')
  if (error) return toFailure(error)
  refresh()
  // Đổi trạng thái (không phải hủy) không đụng tồn kho → không làm mới cache catalog
  if (data.length === 0) return STATUS_CHANGED
  after(() => notifyOrder(supabase, orderId.data, to))
  return { ok: true, data: null }
}

/**
 * Hủy kèm lý do (bắt buộc); trigger hoàn tồn kho + lượt dùng voucher → làm mới trang sách của các sách trong đơn.
 * Đơn chuyển khoản đã thanh toán → `refunded` (cửa hàng hoàn tiền ngoài hệ thống; khách không tự hủy được đơn này).
 */
export async function cancelOrderAsAdmin(
  id: number,
  shownStatus: string,
  _prev: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const orderId = rowIdSchema.safeParse(id)
  const from = orderStatusSchema.safeParse(shownStatus)
  if (!orderId.success || !from.success) return UNKNOWN
  const parsed = adminCancelOrderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)
  if (!canAdminCancel(from.data)) return STATUS_CHANGED

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled', cancelled_reason: parsed.data.reason })
    .eq('id', orderId.data)
    .eq('status', from.data)
    .select('id, payment_status')
  if (error) return toFailure(error)
  refresh()
  const cancelled = data[0]
  if (!cancelled) return STATUS_CHANGED

  if (cancelled.payment_status === 'paid') {
    const refund = await supabase
      .from('orders')
      .update({ payment_status: 'refunded' })
      .eq('id', orderId.data)
      .eq('payment_status', 'paid')
    // Đơn đã hủy xong; chỉ trạng thái thanh toán chưa đổi → log, admin thấy "Đã thanh toán" trên đơn đã hủy
    if (refund.error) console.error('cancelOrderAsAdmin (refunded):', refund.error.message)
  }
  await expireOrderBooks(supabase, orderId.data)
  after(() => notifyOrder(supabase, orderId.data, 'cancelled'))
  return { ok: true, data: null }
}

/** Ghi nhận đã nhận tiền chuyển khoản (admin tự đối soát sao kê); update có điều kiện như đổi trạng thái */
export async function markOrderPaid(id: number): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const orderId = rowIdSchema.safeParse(id)
  if (!orderId.success) return UNKNOWN

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .update({ payment_status: 'paid' })
    .eq('id', orderId.data)
    .eq('payment_method', 'bank_transfer')
    .eq('payment_status', 'unpaid')
    .neq('status', 'cancelled')
    .select('id')
  if (error) return toFailure(error)
  refresh()
  if (data.length === 0) return STATUS_CHANGED
  after(() => notifyOrder(supabase, orderId.data, 'paid'))
  return { ok: true, data: null }
}
