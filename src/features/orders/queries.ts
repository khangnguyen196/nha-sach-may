import 'server-only'
import { createClient } from '@/lib/supabase/server'

// Dữ liệu theo user: client theo phiên (cookies), không cache chung. RLS chỉ trả đơn của người đang đăng nhập
// (admin xem được mọi đơn). Chỉ gọi trong <Suspense>.

const ORDER_COLUMNS = `id, order_code, status, payment_method, recipient_name, phone, province, ward, street, note,
  subtotal, shipping_fee, discount, total, created_at,
  order_items(id, title, cover_url, unit_price, quantity, line_total)`

// Mã đơn do generate_order_code() sinh: NS + YYMMDD + số thứ tự (≥ 5 chữ số)
const ORDER_CODE = /^NS\d{11,16}$/

export async function getOrderByCode(code: string) {
  if (!ORDER_CODE.test(code)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('order_code', code)
    .order('id', { referencedTable: 'order_items' })
    .maybeSingle()
  if (error) throw new Error(`getOrderByCode: ${error.message}`)
  return data
}
