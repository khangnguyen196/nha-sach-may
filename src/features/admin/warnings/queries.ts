import 'server-only'
import { ADMIN_PAGE_SIZE } from '../params'
import { createAdminQueryClient } from '../supabase'
import type { SuggestionListParams } from './params'

// Trang /admin/canh-bao + khối cảnh báo ở trang sửa sách. Client theo phiên, không cache (gợi ý mới phải hiện ngay sau
// mỗi lượt). Chỉ gọi trong <Suspense>.

const RANGE_NOT_SATISFIABLE = 'PGRST103'

/**
 * Gợi ý chờ duyệt, cũ nhất trước, kèm sách (một query). `content_warnings_reviewed_at` của sách đọc nguyên chuỗi để form
 * duyệt gửi lại đúng giá trị cho review_warning_suggestion.
 */
export async function listPendingSuggestions(params: SuggestionListParams) {
  const supabase = await createAdminQueryClient()
  let query = supabase
    .from('content_warning_suggestions')
    .select('id, labels, reason, model, created_at, books(id, title, content_warnings, content_warnings_reviewed_at)', {
      count: 'exact',
    })
    .eq('status', 'pending')
  if (params.sach) query = query.eq('book_id', params.sach)

  const from = ((params.page ?? 1) - 1) * ADMIN_PAGE_SIZE
  const { data, count, error } = await query
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + ADMIN_PAGE_SIZE - 1)
  if (error?.code === RANGE_NOT_SATISFIABLE) return { suggestions: [], total: count ?? 0 }
  if (error) throw new Error(`listPendingSuggestions: ${error.message}`)
  return { suggestions: data, total: count ?? data.length }
}

export type PendingSuggestion = Awaited<ReturnType<typeof listPendingSuggestions>>['suggestions'][number]

/** Số sách chưa xét, và trong đó số sách chưa có gợi ý chờ duyệt (lô gợi ý chỉ chọn nhóm sau) */
export async function countUnreviewedBooks() {
  const supabase = await createAdminQueryClient()
  const [unreviewed, unsuggested] = await Promise.all([
    supabase.from('books').select('id', { count: 'exact', head: true }).is('content_warnings_reviewed_at', null),
    supabase
      .from('books')
      .select('id, content_warning_suggestions(id)', { count: 'exact', head: true })
      .is('content_warnings_reviewed_at', null)
      .eq('content_warning_suggestions.status', 'pending')
      .is('content_warning_suggestions', null),
  ])
  const error = unreviewed.error ?? unsuggested.error
  if (error) throw new Error(`countUnreviewedBooks: ${error.message}`)
  return { unreviewed: unreviewed.count ?? 0, unsuggested: unsuggested.count ?? 0 }
}

/** Id gợi ý đang chờ duyệt của một sách (unique index: tối đa một), không có → null */
export async function getPendingSuggestionId(bookId: number): Promise<number | null> {
  const supabase = await createAdminQueryClient()
  const { data, error } = await supabase
    .from('content_warning_suggestions')
    .select('id')
    .eq('book_id', bookId)
    .eq('status', 'pending')
    .maybeSingle()
  if (error) throw new Error(`getPendingSuggestionId: ${error.message}`)
  return data?.id ?? null
}
