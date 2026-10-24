import 'server-only'
import { ADMIN_PAGE_SIZE } from '../params'
import { createAdminQueryClient } from '../supabase'
import type { PayoutListParams } from './params'

// Khoản trả người bán (sổ tiền MÔ PHỎNG). authenticated, kể cả admin, không đọc được seller_payouts.order_id theo cột →
// RPC admin_seller_payouts() (kiểm is_admin, kèm mã + trạng thái đơn, tên hiển thị người bán, không gì của người mua).
// RPC trả bảng nên PostgREST lọc / sắp xếp / range được như một bảng. Client theo phiên, không cache; trong <Suspense>.

const RANGE_NOT_SATISFIABLE = 'PGRST103'

/** Mới ghi trước; lọc chờ trả / đã trả qua URL (không có = tất cả) */
export async function listAdminPayouts(params: PayoutListParams) {
  const supabase = await createAdminQueryClient()
  const from = ((params.page ?? 1) - 1) * ADMIN_PAGE_SIZE
  let query = supabase.rpc('admin_seller_payouts', {}, { count: 'exact' })
  if (params.status) query = query.eq('status', params.status)
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1)
  if (error?.code === RANGE_NOT_SATISFIABLE) return { payouts: [], total: count ?? 0 }
  if (error) throw new Error(`listAdminPayouts: ${error.message}`)

  return {
    payouts: data.map((row) => {
      // Cột của RPC: types sinh khai không null, nhưng seller_name (người bán chưa đặt tên) và paid_at (chưa trả) có
      // thể null
      const sellerName: string | null = row.seller_name
      const paidAt: string | null = row.paid_at
      return {
        id: row.id,
        orderCode: row.order_code,
        orderStatus: row.order_status,
        paymentStatus: row.payment_status,
        title: row.title,
        sellerName,
        price: row.price,
        fee: row.fee,
        amount: row.amount,
        status: row.status,
        paidAt,
        createdAt: row.created_at,
        // = điều kiện của mark_payout_paid (DB kiểm lại sau khi khóa đơn)
        payable: row.status === 'pending' && row.order_status === 'delivered' && row.payment_status === 'paid',
      }
    }),
    total: count ?? data.length,
  }
}

export type AdminPayout = Awaited<ReturnType<typeof listAdminPayouts>>['payouts'][number]
