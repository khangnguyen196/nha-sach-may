import 'server-only'
import type { Locale } from 'next-intl'
import { getFormatter, getTranslations } from 'next-intl/server'
import { parseLocale } from '@/features/auth/schemas'
import { getBankAccount } from '@/features/payments/bank'
import { getPathname } from '@/i18n/navigation'
import { sendEmail } from '@/lib/email'
import { siteUrl } from '@/lib/site-url'
import type { createClient } from '@/lib/supabase/server'
import { renderOrderEmail } from './email-template'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type OrderEmailKind = 'placed' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled' | 'paid'

/** Người nhận đã biết (khách tự đặt / tự hủy: email trong phiên); không có → RPC order_contact (admin đổi trạng thái) */
export type Recipient = { email: string; locale: Locale }

const EMAIL_ORDER_COLUMNS = `order_code, payment_method, payment_status, subtotal, shipping_fee, discount, total,
  voucher_code, cancelled_reason, order_items(title, quantity, unit_price, line_total)`

async function findRecipient(supabase: Supabase, orderId: number): Promise<Recipient | null> {
  // Cần migration 20261016020000_payments_email.sql (order_contact). Chưa có → lỗi, chỉ ghi log ở notifyOrder.
  const { data, error } = await supabase.rpc('order_contact', { p_order_id: orderId }).maybeSingle()
  if (error) throw new Error(`order_contact: ${error.message}`)
  return data ? { email: data.email, locale: parseLocale(data.locale) } : null
}

/** Ngôn ngữ email (profiles.locale) của người đang đăng nhập: khách tự đặt / tự hủy đơn */
export async function ownRecipient(supabase: Supabase, user: { id: string; email?: string }): Promise<Recipient | null> {
  if (!user.email) return null
  const { data } = await supabase.from('profiles').select('locale').eq('id', user.id).maybeSingle()
  return { email: user.email, locale: parseLocale(data?.locale) }
}

/**
 * Email báo trạng thái đơn theo ngôn ngữ email của người đặt. Gọi trong `after()` (sau khi trả phản hồi). Không
 * throw: email là phụ, mọi lỗi (đơn không đọc được, chưa chạy migration, dịch vụ email lỗi) chỉ ghi log.
 */
export async function notifyOrder(supabase: Supabase, orderId: number, kind: OrderEmailKind, recipient?: Recipient) {
  try {
    const [{ data: order, error }, to] = await Promise.all([
      supabase.from('orders').select(EMAIL_ORDER_COLUMNS).eq('id', orderId).maybeSingle(),
      recipient ? Promise.resolve(recipient) : findRecipient(supabase, orderId),
    ])
    if (error || !order) throw new Error(`order ${orderId}: ${error?.message ?? 'không tìm thấy'}`)
    if (!to) return

    const locale = to.locale
    const [t, tOrder, tPayment, format] = await Promise.all([
      getTranslations({ locale, namespace: 'email' }),
      getTranslations({ locale, namespace: 'order' }),
      getTranslations({ locale, namespace: 'payment' }),
      getFormatter({ locale }),
    ])
    const price = (value: number) => format.number(value, 'price')
    const code = order.order_code
    const bankTransfer = order.payment_method === 'bank_transfer'
    const bank = getBankAccount()
    const notes = [
      ...(kind === 'cancelled' && order.cancelled_reason ? [t('cancelledReason', { reason: order.cancelled_reason })] : []),
      ...(kind === 'cancelled' && order.payment_status === 'refunded' ? [t('refunded')] : []),
    ]

    const transferRows: [string, string][] = [
      [tPayment('bank'), bank.bankName],
      [tPayment('accountNo'), bank.accountNo],
      [tPayment('accountName'), bank.accountName],
      [tPayment('amount'), price(order.total)],
      [tPayment('content'), code],
    ]
    if (bank.demo) transferRows.push(['', tPayment('demoWarning')])

    const content = renderOrderEmail({
      subject: t(`subject.${kind}`, { code }),
      lead: t(`lead.${kind}`),
      notes,
      itemsTitle: t('items'),
      items: order.order_items.map((item) => ({
        title: item.title,
        quantity: t('quantity', { quantity: item.quantity }),
        total: price(item.line_total ?? item.unit_price * item.quantity),
      })),
      totals: [
        { label: t('subtotal'), value: price(order.subtotal) },
        { label: t('shipping'), value: order.shipping_fee === 0 ? t('freeShipping') : price(order.shipping_fee) },
        ...(order.discount > 0
          ? [{ label: order.voucher_code ? `${t('discount')} (${order.voucher_code})` : t('discount'), value: `−${price(order.discount)}` }]
          : []),
      ],
      grandTotal: { label: t('total'), value: price(order.total) },
      paymentLine: t('paymentMethod', { method: bankTransfer ? tOrder('bankTransfer') : tOrder('cod') }),
      // Đơn chuyển khoản vừa đặt: kèm thông tin chuyển khoản dạng chữ (nhiều trình đọc thư chặn ảnh QR inline)
      transfer:
        kind === 'placed' && bankTransfer && order.payment_status === 'unpaid'
          ? {
              title: t('transferTitle'),
              hint: t('transferHint'),
              rows: transferRows,
            }
          : null,
      cta: {
        label: t('viewOrder'),
        href: `${siteUrl()}${getPathname({ href: { pathname: '/account/orders/[code]', params: { code } }, locale })}`,
      },
      footer: t('footer'),
    })
    await sendEmail({ to: to.email, ...content })
  } catch (error) {
    console.error(`[email] đơn ${orderId} (${kind}):`, error instanceof Error ? error.message : error)
  }
}
