import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { CHAT_CATALOG_TAG } from '@/features/admin/cache-tags'
import { createPublicClient } from '@/lib/supabase/public'

/**
 * Catalog rút gọn để lọc ứng viên (chạy trong bộ nhớ, ~200 sách). Client anon: RLS chỉ trả sách đang hiện.
 * Không gắn tag book:{id} từng sách (Next giới hạn 128 tag / mục cache): admin sửa sách / danh mục / tác giả làm mới
 * qua tag `chat-catalog`. Tồn kho, giá dùng để hiển thị lấy ở getChatBookCards (tag theo từng sách).
 */
export async function getChatCatalog() {
  'use cache'
  cacheTag('books', 'categories', CHAT_CATALOG_TAG)
  cacheLife('hours')

  const { data, error } = await createPublicClient()
    .from('books')
    .select(
      'id, slug, title, language, category_id, stock, sold_count, is_featured, cover_width, description, book_authors(role, authors(name))',
    )
    .order('id')
  if (error) throw new Error(`getChatCatalog: ${error.message}`)
  return data
}

export type ChatCatalogBook = Awaited<ReturnType<typeof getChatCatalog>>[number]

/** Thẻ sách của câu trả lời (≤ 3 cuốn), dữ liệu thật từ DB; sách đã ẩn / xóa không có trong kết quả */
export async function getChatBookCards(slugs: string[]) {
  'use cache'
  cacheTag('books')
  cacheLife('hours')

  if (slugs.length === 0) return []
  const { data, error } = await createPublicClient()
    .from('books')
    .select('id, slug, title, cover_url, price, original_price, stock, book_authors(role, authors(name))')
    .in('slug', slugs)
  if (error) throw new Error(`getChatBookCards: ${error.message}`)
  if (data.length > 0) cacheTag(...data.map((book) => `book:${book.id}`))
  return data
}

export type ChatBookCardRow = Awaited<ReturnType<typeof getChatBookCards>>[number]
