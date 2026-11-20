import 'server-only'
import { cacheLife } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'

export type ShippingTerms = {
  /** Mốc miễn phí giao hàng (VND), từ private.free_ship_from() qua quote_items */
  freeShipFrom: number
  /** Phí giao của đơn dưới mốc; null khi không đọc được (không có sách nào rẻ hơn mốc) */
  fee: number | null
}

/**
 * Điều kiện giao hàng cho thẻ "Miễn phí giao hàng", không hard-code: RPC quote_items (anon) tạm tính giỏ một cuốn rẻ
 * nhất → free_ship_from (mốc) + shipping_fee (phí khi dưới mốc; giỏ rỗng luôn trả phí 0 nên không đọc được phí từ
 * quote_items('[]')). Catalog trống → quote_items('[]') chỉ còn mốc. Hằng số chỉ đổi qua migration (kèm deploy), cache
 * theo ngày.
 */
export async function getShippingTerms(): Promise<ShippingTerms> {
  'use cache'
  cacheLife('days')

  const supabase = createPublicClient()
  const { data: cheapest, error: bookError } = await supabase
    .from('books')
    .select('id')
    .order('price')
    .order('id')
    .limit(1)
    .maybeSingle()
  if (bookError) throw new Error(`getShippingTerms (book): ${bookError.message}`)

  const items = cheapest ? [{ book_id: cheapest.id, quantity: 1 }] : []
  const { data, error } = await supabase.rpc('quote_items', { p_items: items }).single()
  if (error) throw new Error(`getShippingTerms (quote): ${error.message}`)
  return { freeShipFrom: data.free_ship_from, fee: data.shipping_fee > 0 ? data.shipping_fee : null }
}

/**
 * getShippingTerms cho trang chủ: lỗi (query sách / RPC quote_items) → null = ẩn thẻ "Miễn phí giao hàng", không kéo cả
 * trang chủ vào trang lỗi. Bắt lỗi ở NGOÀI 'use cache': bắt bên trong thì kết quả null được cache cả ngày. Lỗi lúc build
 * → HTML tĩnh của trang chủ thiếu thẻ ship tới lần dựng lại kế tiếp (chấp nhận).
 */
export async function getShippingTermsOrNull(): Promise<ShippingTerms | null> {
  try {
    return await getShippingTerms()
  } catch (error) {
    // Đứng đầu catch: lỗi nội bộ của Next lúc prerender (dừng prerender ở dữ liệu động…) phải ném tiếp, không thành null
    unstable_rethrow(error)
    console.error('getShippingTermsOrNull:', error instanceof Error ? error.message.slice(0, 200) : 'unknown error')
    return null
  }
}
