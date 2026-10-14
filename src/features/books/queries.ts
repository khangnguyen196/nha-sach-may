import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import type { SearchHit } from './schemas'

/** Danh mục đang hiển thị, theo thứ tự sort_order. Admin sửa danh mục → revalidateTag('categories'). */
export async function getCategories() {
  'use cache'
  cacheTag('categories')
  cacheLife('max')

  const { data, error } = await createPublicClient()
    .from('categories')
    .select('id, parent_id, name, name_en, slug, sort_order')
    .order('sort_order')
    .order('id')
  if (error) throw new Error(`getCategories: ${error.message}`)
  return data
}

/** Sách mới nhập gần đây (trang chủ tạm Phase 1; Phase 8 thay bằng kệ "Mới về"). */
export async function getNewBooks(limit = 12) {
  'use cache'
  cacheTag('books')
  cacheLife('hours')

  const { data, error } = await createPublicClient()
    .from('books')
    .select('id, title, slug, cover_url, price, original_price, book_authors(role, authors(name))')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`getNewBooks: ${error.message}`)
  return data
}

const SEARCH_HIT_LIMIT = 8

/** Gợi ý cho command palette: tối đa 8 sách khớp từ khóa (q đã qua searchQuerySchema). */
export async function searchBookHits(q: string): Promise<SearchHit[]> {
  'use cache'
  cacheTag('books')
  cacheLife('hours')

  const { data, error } = await createPublicClient()
    .rpc('search_books', { q })
    .select('id, slug, title, cover_url, book_authors(role, authors(name))')
    .range(0, SEARCH_HIT_LIMIT - 1)
  if (error) throw new Error(`searchBookHits: ${error.message}`)

  return data.map((book) => ({
    id: book.id,
    slug: book.slug,
    title: book.title,
    coverUrl: book.cover_url,
    authors: book.book_authors.flatMap((ba) => (ba.role === 'author' && ba.authors ? [ba.authors.name] : [])),
  }))
}
