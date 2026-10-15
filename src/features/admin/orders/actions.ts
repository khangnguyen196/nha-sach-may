'use server'

import { refresh } from 'next/cache'
import { expireOrderBooks } from '@/features/orders/cache'
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
  return data.length === 0 ? STATUS_CHANGED : { ok: true, data: null }
}

/** Hủy kèm lý do (bắt buộc); trigger hoàn tồn kho + lượt dùng voucher → làm mới trang sách của các sách trong đơn */
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
    .select('id')
  if (error) return toFailure(error)
  refresh()
  if (data.length === 0) return STATUS_CHANGED

  await expireOrderBooks(supabase, orderId.data)
  return { ok: true, data: null }
}
