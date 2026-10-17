import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { FILTER_STATUSES, ORDERS_PAGE_SIZE, type OrderListParams } from './params'

// Dữ liệu theo user: client theo phiên (cookies), không cache chung. Chỉ gọi trong <Suspense>.
// Luôn lọc user_id của người đang đăng nhập, không chỉ dựa vào RLS: policy orders_select_own_or_admin cho admin đọc
// mọi đơn (cần cho /admin), nên trang tài khoản / đặt hàng thành công của admin sẽ lộ đơn của khách khác.

const ORDER_COLUMNS = `id, order_code, status, payment_method, payment_status, recipient_name, phone, province, ward,
  street, note, subtotal, shipping_fee, discount, voucher_code, total, cancelled_reason, created_at,
  order_items(id, book_id, title, cover_url, unit_price, quantity, line_total, books(slug, is_active))`

// Mã đơn do generate_order_code() sinh: NS + YYMMDD + số thứ tự (≥ 5 chữ số)
export const ORDER_CODE = /^NS\d{11,16}$/

export async function getOrderByCode(code: string, userId: string) {
  if (!ORDER_CODE.test(code)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('order_code', code)
    .eq('user_id', userId)
    .order('id', { referencedTable: 'order_items' })
    .maybeSingle()
  if (error) throw new Error(`getOrderByCode: ${error.message}`)
  return data
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderByCode>>>

const RANGE_NOT_SATISFIABLE = 'PGRST103'

/**
 * Đơn của tôi, mới nhất trước, kèm dòng sách (tên, bìa cho ảnh nhỏ ở danh sách) trong cùng một query.
 * count 'exact': đơn của một người ít, đếm chính xác rẻ. Không dùng order_items(count): aggregate của PostgREST
 * đang tắt trên Supabase.
 */
export async function listOrders({ status, page }: OrderListParams, userId: string) {
  const supabase = await createClient()
  let query = supabase
    .from('orders')
    .select('id, order_code, status, total, created_at, order_items(id, title, cover_url, quantity)', { count: 'exact' })
    .eq('user_id', userId)
  if (status) query = query.in('status', FILTER_STATUSES[status])

  const from = (page - 1) * ORDERS_PAGE_SIZE
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .order('id', { referencedTable: 'order_items' })
    .range(from, from + ORDERS_PAGE_SIZE - 1)
  // Offset vượt quá số dòng: PostgREST trả 416 thay vì mảng rỗng → trang rỗng (page gọi notFound)
  if (error?.code === RANGE_NOT_SATISFIABLE) return { orders: [], total: count ?? 0 }
  if (error) throw new Error(`listOrders: ${error.message}`)
  return { orders: data, total: count ?? data.length }
}

export type OrderListItem = Awaited<ReturnType<typeof listOrders>>['orders'][number]
