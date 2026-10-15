'use server'

import { refresh, updateTag } from 'next/cache'
import { after } from 'next/server'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { getPathname, redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import { withMessage } from '@/lib/error-message'
import { invalidInput, toFailure, type Failure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { parseLocale } from '@/features/auth/schemas'
import { expireOrderBooks } from '@/features/orders/cache'
import { notifyOrder, ownRecipient } from '@/features/orders/emails'
import { checkoutSchema } from './schemas'

// locale do page bind sẵn (Server Action không đọc được next/root-params); tham số bind đi qua client nên parse lại.
// Client chỉ gửi địa chỉ, ghi chú, phương thức thanh toán, mã voucher, idempotency key và tổng đang hiển thị (để
// place_order so sánh); giá, phí ship, giảm giá, tổng tiền đều do place_order tính.

function redirectToLogin(locale: Locale): never {
  return redirect({
    href: { pathname: '/login', query: { next: getPathname({ href: '/checkout', locale }) } },
    locale,
  })
}

async function failed(locale: Locale, failure: Failure): Promise<Failure> {
  if (failure.code === 'AUTH_REQUIRED') redirectToLogin(locale)
  if (failure.code === 'INVALID_INPUT') {
    // Ràng buộc của place_order trùng với checkoutSchema (chỉ có ghi chú) → hiện tại ô
    return failure.details?.field === 'note' ? { ok: false, code: 'INVALID_INPUT', fieldErrors: { note: 'note' } } : failure
  }
  // UNKNOWN: không làm mới trang để lần bấm lại giữ nguyên idempotency key (đơn có thể đã tạo mà mất phản hồi)
  if (failure.code === 'UNKNOWN') return withMessage(locale, failure)

  // Lỗi tồn kho / ngừng bán nghĩa là cache của sách đó đang cũ
  const bookId = failure.details?.book_id
  if (typeof bookId === 'number') updateTag(`book:${bookId}`)
  // Trang hiện trạng thái thật: địa chỉ còn lại, giỏ rỗng, tổng mới, cảnh báo từng dòng
  refresh()

  if (failure.code === 'INVALID_ADDRESS') {
    const t = await getTranslations({ locale, namespace: 'checkout' })
    return { ...failure, message: t('addressGone') }
  }
  return withMessage(locale, failure)
}

export async function placeOrder(locale: Locale, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const safeLocale = parseLocale(locale)
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)
  const user = await getCurrentUser()
  if (!user) redirectToLogin(safeLocale)

  const supabase = await createClient()
  const { data: order, error } = await supabase.rpc('place_order', {
    p_address_id: parsed.data.address_id,
    p_payment_method: parsed.data.payment_method,
    p_voucher_code: parsed.data.voucher_code ?? undefined,
    p_note: parsed.data.note ?? undefined,
    // Gửi lại cùng key (double submit, mất phản hồi) → place_order trả đúng đơn đã tạo
    p_idempotency_key: parsed.data.idempotency_key,
    // place_order so với tổng vừa tính sau khi khóa giỏ; lệch → CART_CHANGED
    p_expected_total: parsed.data.expected_total,
  })
  if (error) return failed(safeLocale, toFailure(error))

  await expireOrderBooks(supabase, order.id)
  // Gửi lại cùng key (đơn đã có) vẫn vào đây: email "đã nhận đơn" có thể gửi hai lần, chấp nhận
  after(async () => {
    const recipient = await ownRecipient(supabase, user)
    if (recipient) await notifyOrder(supabase, order.id, 'placed', recipient)
  })
  return redirect({
    href: { pathname: '/checkout/success/[code]', params: { code: order.order_code } },
    locale: safeLocale,
  })
}
