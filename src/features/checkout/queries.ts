import 'server-only'
import type { Locale } from 'next-intl'
import { withMessage } from '@/lib/error-message'
import { toFailure, type Failure } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export type CheckoutQuote = Database['public']['Functions']['quote_order']['Returns'][number]

/** Mã trên URL: đã áp dụng (failure null) hoặc bị từ chối kèm lỗi đã dịch (quote tính không voucher) */
export type VoucherState = { code: string; failure: Failure | null }

const VOUCHER_ERRORS = new Set(['INVALID_VOUCHER', 'VOUCHER_MIN_ORDER'])

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
  code: string | null,
): Promise<{ quote: CheckoutQuote; voucher: VoucherState | null }> {
  const first = await quote(code)
  if (!first.error) return { quote: first.data, voucher: code ? { code, failure: null } : null }

  const failure = toFailure(first.error)
  if (!code || !VOUCHER_ERRORS.has(failure.code)) throw new Error(`getCheckoutQuote: ${first.error.message}`)
  const plain = await quote(null)
  if (plain.error) throw new Error(`getCheckoutQuote: ${plain.error.message}`)
  return { quote: plain.data, voucher: { code, failure: await withMessage(locale, failure) } }
}
