import 'server-only'
import { escapeLike } from '@/lib/like'
import { ADMIN_PAGE_SIZE } from '../params'
import { createAdminQueryClient } from '../supabase'
import type { VoucherListParams } from './params'

// Client theo phiên, không cache (RLS: chỉ admin đọc được vouchers). Chỉ gọi trong <Suspense>.

const RANGE_NOT_SATISFIABLE = 'PGRST103'

const VOUCHER_COLUMNS =
  'id, code, description, description_en, discount_type, discount_value, max_discount, min_order_value, usage_limit, used_count, starts_at, ends_at, is_active, is_public'

/** Danh sách voucher, mới tạo trước. Tìm theo mã (mã luôn viết HOA → so không phân biệt hoa thường). */
export async function listAdminVouchers(params: VoucherListParams) {
  const supabase = await createAdminQueryClient()
  let query = supabase.from('vouchers').select(VOUCHER_COLUMNS, { count: 'exact' })
  if (params.q) query = query.ilike('code', `%${escapeLike(params.q)}%`)

  const from = ((params.page ?? 1) - 1) * ADMIN_PAGE_SIZE
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1)
  if (error?.code === RANGE_NOT_SATISFIABLE) return { vouchers: [], total: count ?? 0 }
  if (error) throw new Error(`listAdminVouchers: ${error.message}`)
  return { vouchers: data, total: count ?? data.length }
}

export type AdminVoucherRow = Awaited<ReturnType<typeof listAdminVouchers>>['vouchers'][number]

/** Voucher + số đơn đã gắn mã (kể cả đơn đã hủy: used_count giảm khi hủy nhưng đơn vẫn trỏ tới voucher) */
export async function getAdminVoucher(id: number) {
  const supabase = await createAdminQueryClient()
  const [voucher, orders] = await Promise.all([
    supabase.from('vouchers').select(VOUCHER_COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('voucher_id', id),
  ])
  if (voucher.error) throw new Error(`getAdminVoucher: ${voucher.error.message}`)
  if (orders.error) throw new Error(`getAdminVoucher (orders): ${orders.error.message}`)
  return voucher.data ? { ...voucher.data, orderCount: orders.count ?? 0 } : null
}

export type AdminVoucher = NonNullable<Awaited<ReturnType<typeof getAdminVoucher>>>
