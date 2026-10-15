import 'server-only'
import { containsPatterns } from '@/lib/like'
import { createClient } from '@/lib/supabase/server'
import { ADMIN_PAGE_SIZE } from '../params'
import { LOW_STOCK, type BookListParams } from './params'

// Client theo phiên, không 'use cache': admin cần thấy sách / danh mục ẩn (RLS cho admin) và dữ liệu mới nhất.
// Đọc cookies → chỉ gọi trong <Suspense>.

const RANGE_NOT_SATISFIABLE = 'PGRST103'

const LIST_COLUMNS = 'id, slug, title, cover_url, price, stock, is_active, is_featured, categories(name)'

/**
 * Danh sách sách của admin, 25 dòng / trang. Tìm trên `search_text` (tên + phụ đề + ISBN + tác giả, đã bỏ dấu, có
 * index trigram), mỗi từ một `ilike` đã escape: gõ `%` / `_` không khớp mọi sách.
 */
export async function listAdminBooks(params: BookListParams) {
  const supabase = await createClient()
  let query = supabase.from('books').select(LIST_COLUMNS, { count: 'exact' })
  for (const pattern of containsPatterns(params.q ?? '')) query = query.ilike('search_text', pattern)
  if (params.category) query = query.eq('category_id', params.category)
  if (params.status) query = query.eq('is_active', params.status === 'active')
  if (params.stock === 'low') query = query.gt('stock', 0).lte('stock', LOW_STOCK)
  if (params.stock === 'out') query = query.eq('stock', 0)

  const from = ((params.page ?? 1) - 1) * ADMIN_PAGE_SIZE
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1)
  // Trang vượt quá số dòng: PostgREST trả 416 → coi là trang rỗng
  if (error?.code === RANGE_NOT_SATISFIABLE) return { books: [], total: count ?? 0 }
  if (error) throw new Error(`listAdminBooks: ${error.message}`)
  return { books: data, total: count ?? data.length }
}

export type AdminBookRow = Awaited<ReturnType<typeof listAdminBooks>>['books'][number]

const BOOK_COLUMNS = `id, title, slug, subtitle, description, description_en, isbn, price, original_price, stock, cover_url,
  page_count, format, language, published_year, weight_grams, dimensions, category_id, publisher_id, is_active,
  is_featured, book_authors(author_id, role)`

export async function getAdminBook(id: number) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('books').select(BOOK_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(`getAdminBook: ${error.message}`)
  return data
}

export type AdminBook = NonNullable<Awaited<ReturnType<typeof getAdminBook>>>

/** NXB và tác giả cho các ô chọn của form sách (danh mục: getAdminCategories) */
export async function getBookFormOptions() {
  const supabase = await createClient()
  const [publishers, authors] = await Promise.all([
    supabase.from('publishers').select('id, name').order('name'),
    supabase.from('authors').select('id, name').order('name'),
  ])
  if (publishers.error) throw new Error(`getBookFormOptions (publishers): ${publishers.error.message}`)
  if (authors.error) throw new Error(`getBookFormOptions (authors): ${authors.error.message}`)
  return { publishers: publishers.data, authors: authors.data }
}
