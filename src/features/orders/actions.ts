'use server'

import { refresh } from 'next/cache'
import { after } from 'next/server'
import type { Locale } from 'next-intl'
import { getPathname, redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import { withMessage } from '@/lib/error-message'
import { invalidInput, toFailure, type ErrorCode, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { parseLocale } from '@/features/auth/schemas'
import { expireOrderBooks } from './cache'
import { notifyOrder, ownRecipient } from './emails'
import { ORDER_CODE } from './params'
import { cancelOrderSchema, orderIdSchema } from './schemas'

// Khách không tự hủy được nữa (cửa hàng vừa xác nhận, vừa nhận tiền, đơn đã hủy ở tab khác…): trang phải hiện trạng thái thật
const CANCEL_REFUSED = new Set<ErrorCode>([
  'ORDER_NOT_CANCELLABLE',
  'ORDER_ALREADY_CANCELLED',
  'ORDER_DELIVERED',
  'ORDER_IN_PROGRESS',
  'ORDER_PAID',
])

// locale, id và mã đơn do page bind sẵn (Server Action không đọc được next/root-params); tham số bind đi qua client
// nên parse lại. Quyền hủy do cancel_order quyết định (đơn của chính mình, còn `pending`, trong cùng câu update).

function redirectToLogin(locale: Locale, code: string): never {
  const href = ORDER_CODE.test(code)
    ? { pathname: '/account/orders/[code]' as const, params: { code } }
    : { pathname: '/account/orders' as const }
  return redirect({ href: { pathname: '/login', query: { next: getPathname({ href, locale }) } }, locale })
}

export async function cancelOrder(
  locale: Locale,
  orderId: number,
  code: string,
  _prev: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const safeLocale = parseLocale(locale)
  const id = orderIdSchema.safeParse(orderId)
  if (!id.success) return { ok: false, code: 'ORDER_NOT_CANCELLABLE' }
  const parsed = cancelOrderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)
  const user = await getCurrentUser()
  if (!user) redirectToLogin(safeLocale, code)

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_order', {
    p_order_id: id.data,
    p_reason: parsed.data.reason ?? undefined,
  })
  if (error) {
    const failure = toFailure(error)
    // Ràng buộc của cancel_order trùng với cancelOrderSchema (chỉ có lý do) → hiện tại ô
    if (failure.code === 'INVALID_INPUT') return { ok: false, code: 'INVALID_INPUT', fieldErrors: { reason: 'reason' } }
    // Trang hiện trạng thái thật, khối hủy biến mất; câu lỗi nói lý do + cách liên hệ
    if (CANCEL_REFUSED.has(failure.code)) refresh()
    return withMessage(safeLocale, failure)
  }

  // Hủy đơn hoàn tồn kho (trigger) → trang sách và danh sách đang chứa các sách này hết cũ
  await expireOrderBooks(supabase, id.data)
  after(async () => {
    const recipient = await ownRecipient(supabase, user)
    if (recipient) await notifyOrder(supabase, id.data, 'cancelled', recipient)
  })
  refresh()
  return { ok: true, data: null }
}
