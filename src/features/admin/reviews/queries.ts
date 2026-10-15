import 'server-only'
import { ADMIN_PAGE_SIZE } from '../params'
import { createAdminQueryClient } from '../supabase'
import type { ReviewListParams } from './params'

// Client theo phiên, không cache: trang kiểm duyệt cần thấy đánh giá mới ngay. Chỉ gọi trong <Suspense>.

const RANGE_NOT_SATISFIABLE = 'PGRST103'

/** Đánh giá mới nhất trước, kèm tên + slug sách (một query) */
export async function listAdminReviews(params: ReviewListParams) {
  const supabase = await createAdminQueryClient()
  let query = supabase
    .from('reviews')
    .select('id, book_id, rating, content, display_name, created_at, books(title, slug)', { count: 'exact' })
  if (params.sao) query = query.eq('rating', Number(params.sao))

  const from = ((params.page ?? 1) - 1) * ADMIN_PAGE_SIZE
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1)
  if (error?.code === RANGE_NOT_SATISFIABLE) return { reviews: [], total: count ?? 0 }
  if (error) throw new Error(`listAdminReviews: ${error.message}`)
  return { reviews: data, total: count ?? data.length }
}
