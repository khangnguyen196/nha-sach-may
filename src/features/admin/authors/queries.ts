import 'server-only'
import { slugContainsPatterns } from '@/lib/like'
import { createClient } from '@/lib/supabase/server'
import { ADMIN_PAGE_SIZE } from '../params'
import type { AuthorListParams } from './params'

// Client theo phiên, không cache. Chỉ gọi trong <Suspense>.

const RANGE_NOT_SATISFIABLE = 'PGRST103'

/** Danh sách tác giả, 25 dòng / trang, kèm số sách (đếm ở DB). Tìm trên slug (đã bỏ dấu), từ khóa đã escape. */
export async function listAdminAuthors(params: AuthorListParams) {
  const supabase = await createClient()
  let query = supabase.from('authors').select('id, name, slug, book_authors(count)', { count: 'exact' })
  for (const pattern of slugContainsPatterns(params.q ?? '')) query = query.ilike('slug', pattern)

  const from = ((params.page ?? 1) - 1) * ADMIN_PAGE_SIZE
  const { data, count, error } = await query.order('name').order('id').range(from, from + ADMIN_PAGE_SIZE - 1)
  if (error?.code === RANGE_NOT_SATISFIABLE) return { authors: [], total: count ?? 0 }
  if (error) throw new Error(`listAdminAuthors: ${error.message}`)
  return {
    authors: data.map(({ book_authors, ...author }) => ({ ...author, bookCount: book_authors[0]?.count ?? 0 })),
    total: count ?? data.length,
  }
}

/** Tác giả + các sách của tác giả (một người có thể vừa là tác giả vừa là dịch giả của cùng một cuốn) */
export async function getAdminAuthor(id: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('authors')
    .select('id, name, slug, bio, bio_en, book_authors(role, books(id, title))')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`getAdminAuthor: ${error.message}`)
  if (!data) return null
  const { book_authors, ...author } = data
  const books = new Map<number, string>()
  for (const { books: book } of book_authors) if (book) books.set(book.id, book.title)
  return { ...author, books: [...books].map(([bookId, title]) => ({ id: bookId, title })) }
}
