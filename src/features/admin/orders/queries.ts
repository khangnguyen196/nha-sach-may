import 'server-only'
import { ORDER_CODE } from '@/features/orders/params'
import { escapeLike, quoteFilterValue } from '@/lib/like'
import { ADMIN_PAGE_SIZE } from '../params'
import { createAdminQueryClient } from '../supabase'
import type { OrderListParams } from './params'

// Client theo phiên, không cache (RLS cho admin xem mọi đơn). Chỉ gọi trong <Suspense>.

const RANGE_NOT_SATISFIABLE = 'PGRST103'

/**
 * Tìm theo mã đơn / SĐT (bỏ khoảng trắng: "0901 234 567") hoặc tên người nhận. Một bộ lọc `.or()`, giá trị quote +
 * escape (gõ `%`, `,`, `)` không phá cú pháp hay khớp mọi đơn).
 */
function orderSearchFilter(q: string) {
  const compact = q.replace(/\s+/g, '')
  const pattern = (value: string) => quoteFilterValue(`%${escapeLike(value)}%`)
  return [
    `order_code.ilike.${pattern(compact)}`,
    `phone.ilike.${pattern(compact)}`,
    `recipient_name.ilike.${pattern(q)}`,
  ].join(',')
}

/** Danh sách đơn, mới nhất trước, 25 dòng / trang */
export async function listAdminOrders(params: OrderListParams) {
  const supabase = await createAdminQueryClient()
  let query = supabase
    .from('orders')
    .select('id, order_code, status, payment_status, recipient_name, phone, total, created_at', { count: 'exact' })
  if (params.status) query = query.eq('status', params.status)
  if (params.q) query = query.or(orderSearchFilter(params.q))

  const from = ((params.page ?? 1) - 1) * ADMIN_PAGE_SIZE
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1)
  if (error?.code === RANGE_NOT_SATISFIABLE) return { orders: [], total: count ?? 0 }
  if (error) throw new Error(`listAdminOrders: ${error.message}`)
  return { orders: data, total: count ?? data.length }
}

/** Cùng cột với trang chi tiết của khách (OrderDetails dùng chung) + người đặt, voucher, thời điểm cập nhật */
const ORDER_COLUMNS = `id, order_code, status, payment_method, payment_status, recipient_name, phone, province, ward,
  street, note, subtotal, shipping_fee, discount, total, voucher_code, cancelled_reason, created_at, updated_at,
  profiles(full_name), order_items(id, book_id, title, cover_url, unit_price, quantity, line_total)`

export async function getAdminOrder(code: string) {
  if (!ORDER_CODE.test(code)) return null
  const supabase = await createAdminQueryClient()
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('order_code', code)
    .order('id', { referencedTable: 'order_items' })
    .maybeSingle()
  if (error) throw new Error(`getAdminOrder: ${error.message}`)
  return data
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>
