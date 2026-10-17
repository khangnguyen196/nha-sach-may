import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'

/** Số đánh giá hiện ở trang sách (mới nhất trước); catalog nhỏ, chưa cần phân trang */
export const REVIEW_LIMIT = 20

/**
 * Đánh giá công khai của một sách. Cache chung (client anon), tag `book:{id}`: viết / sửa / xóa đánh giá gọi
 * updateTag cùng tag (trigger cũng đổi avg_rating / review_count của sách → trang sách làm mới cùng lúc).
 */
export async function getBookReviews(bookId: number) {
  'use cache'
  cacheTag(`book:${bookId}`)
  cacheLife('hours')

  const { data, count, error } = await createPublicClient()
    .from('reviews')
    .select('id, display_name, rating, content, created_at', { count: 'exact' })
    .eq('book_id', bookId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(REVIEW_LIMIT)
  if (error) throw new Error(`getBookReviews: ${error.message}`)
  return { reviews: data, total: count ?? data.length }
}

export type BookReview = Awaited<ReturnType<typeof getBookReviews>>['reviews'][number]

/**
 * Đánh giá của người đang đăng nhập cho sách này + đã nhận sách chưa (có đơn `delivered` chứa sách, cùng điều kiện
 * với RLS reviews_insert_if_purchased). Theo phiên, không cache → chỉ gọi trong <Suspense>.
 */
export async function getMyReviewState(bookId: number, userId: string) {
  const supabase = await createClient()
  const [own, delivered] = await Promise.all([
    supabase.from('reviews').select('id, rating, content').eq('book_id', bookId).eq('user_id', userId).maybeSingle(),
    supabase
      .from('order_items')
      .select('id, orders!inner(id)')
      .eq('book_id', bookId)
      .eq('orders.user_id', userId)
      .eq('orders.status', 'delivered')
      .limit(1),
  ])
  if (own.error) throw new Error(`getMyReviewState (review): ${own.error.message}`)
  if (delivered.error) throw new Error(`getMyReviewState (orders): ${delivered.error.message}`)
  return { review: own.data, eligible: delivered.data.length > 0 }
}

export type MyReview = NonNullable<Awaited<ReturnType<typeof getMyReviewState>>['review']>

/**
 * Đánh giá của người đang đăng nhập cho nhiều sách trong MỘT query (dòng sách ở trang đơn đã giao), book_id → đánh giá.
 * Theo phiên, không cache → chỉ gọi trong <Suspense>.
 */
export async function getMyReviews(bookIds: number[], userId: string): Promise<Map<number, MyReview>> {
  if (bookIds.length === 0) return new Map()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reviews')
    .select('id, book_id, rating, content')
    .eq('user_id', userId)
    .in('book_id', bookIds)
  if (error) throw new Error(`getMyReviews: ${error.message}`)
  return new Map(data.map(({ book_id, ...review }) => [book_id, review]))
}
