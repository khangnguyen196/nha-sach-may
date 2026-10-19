import 'server-only'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { withMessage } from '@/lib/error-message'
import { toFailure, type Failure } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import type { VoucherInput } from './voucher'
import { minOrderShortfall, VOUCHER_ERRORS } from './voucher-errors'
import type { CheckoutVoucherRow } from './voucher-suggestions'

export type CheckoutQuote = Database['public']['Functions']['quote_order']['Returns'][number]

/** Mã trên URL: đã áp dụng (failure null) hoặc bị từ chối kèm lỗi đã dịch (quote tính không voucher) */
export type VoucherState = { code: string; failure: Failure | null }

async function quote(code: string | null) {
  const supabase = await createClient()
  return supabase.rpc('quote_order', code ? { p_voucher_code: code } : {}).single()
}

/**
 * Tiền tạm tính ở checkout (quote_order, kèm voucher nếu có). Mã sai / hết hạn / chưa đủ giá trị tối thiểu không làm
 * vỡ trang: tính lại không voucher, trả lỗi để hiện dưới ô mã. Client theo phiên → chỉ gọi trong <Suspense>.
 */
export async function getCheckoutQuote(
  locale: Locale,
  input: VoucherInput,
): Promise<{ quote: CheckoutQuote; voucher: VoucherState | null }> {
  // Gõ sai dạng (có dấu, quá ngắn…): không hỏi DB, báo như mã không tồn tại
  if (input && 'invalid' in input) {
    const plain = await quote(null)
    if (plain.error) throw new Error(`getCheckoutQuote: ${plain.error.message}`)
    const failure = await withMessage(locale, { ok: false, code: 'VOUCHER_NOT_FOUND' })
    return { quote: plain.data, voucher: { code: input.invalid, failure } }
  }
  const code = input?.code ?? null
  const first = await quote(code)
  if (!first.error) return { quote: first.data, voucher: code ? { code, failure: null } : null }

  const failure = toFailure(first.error)
  if (!code || !VOUCHER_ERRORS.has(failure.code)) throw new Error(`getCheckoutQuote: ${first.error.message}`)
  const plain = await quote(null)
  if (plain.error) throw new Error(`getCheckoutQuote: ${plain.error.message}`)
  return { quote: plain.data, voucher: { code, failure: await voucherFailure(locale, failure, plain.data.subtotal) } }
}

/** Chưa đủ đơn tối thiểu → nói rõ còn thiếu bao nhiêu (minOrderShortfall) */
async function voucherFailure(locale: Locale, failure: Failure, subtotal: number): Promise<Failure> {
  const values = failure.code === 'VOUCHER_MIN_ORDER' ? minOrderShortfall(failure.details, subtotal) : null
  if (!values) return withMessage(locale, failure)
  const t = await getTranslations({ locale, namespace: 'checkout' })
  return { ...failure, message: t('voucherMinOrderShortfall', values) }
}

/**
 * Mã gợi ý ở trang thanh toán (RPC checkout_vouchers: mã public đang dùng được + mức giảm / số tiền còn thiếu với giỏ
 * hiện tại). Gợi ý là phần phụ: lỗi → không gợi ý (ẩn nút), trang vẫn đặt hàng được. Client theo phiên → trong <Suspense>.
 */
export async function getCheckoutVouchers(): Promise<CheckoutVoucherRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('checkout_vouchers')
  if (error) {
    console.error('getCheckoutVouchers:', error.message)
    return []
  }
  return data
}
