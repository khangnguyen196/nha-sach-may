import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { cache } from 'react'
import { SHARP_COVER_WIDTH } from '@/lib/cover-image'
import { bookBlockKeys } from '@/features/prefs/blocks'
import { createPublicClient } from '@/lib/supabase/public'
import { PAGE_SIZE, PRICE_BOUNDS } from './catalog-params'
import type { PriceRange, SearchHit, Sort } from './schemas'
import { homeShelves, visibleBooksFilter, visibleCategoryIds } from './utils'

/** Danh mục đang hiển thị, theo thứ tự sort_order. Admin sửa danh mục → revalidateTag('categories'). */
export async function getCategories() {
  'use cache'
  cacheTag('categories')
  cacheLife('max')

  const { data, error } = await createPublicClient()
    .from('categories')
    .select('id, parent_id, name, name_en, description, description_en, slug, sort_order')
    .order('sort_order')
    .order('id')
  if (error) throw new Error(`getCategories: ${error.message}`)
  return data
}

export type Category = Awaited<ReturnType<typeof getCategories>>[number]

/** Danh mục theo slug, lấy từ danh sách đã cache (bảng nhỏ, không tốn thêm request) */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const categories = await getCategories()
  return categories.find((category) => category.slug === slug) ?? null
}

/**
 * Gắn tag `book:{id}` của từng sách trả về vào cache danh sách: đặt hàng (trừ tồn kho) chỉ làm mới các danh sách
 * đang chứa sách đó, không làm mới cả catalog. Tối đa 128 tag / lần gọi; danh sách dài nhất là PAGE_SIZE (24).
 */
function tagBooks(books: readonly { id: number }[]) {
  if (books.length > 0) cacheTag(...books.map((book) => `book:${book.id}`))
}

// Cột của BookCard, dùng chung cho lưới, kệ, trang chủ. Kiểu BookCard derive từ query bên dưới. category_id,
// publisher_id, content_warnings, author_id: khóa chặn theo sở thích trên khung thẻ (features/prefs/blocks.ts).
const BOOK_CARD_COLUMNS =
  'id, slug, title, cover_url, price, original_price, stock, category_id, publisher_id, content_warnings, book_authors(role, author_id, authors(name))'

const SHELF_SIZE = 12
/** Ẩn cả kệ (kể cả tiêu đề) khi ít sách hơn mức này (sau khi loại sách trùng kệ trên); kệ khác luôn hiện */
const SHELF_MIN = { featured: 4, bestselling: 6 }
/** Ứng viên mỗi query của kệ: dư để kệ sau vẫn đầy sau khi loại sách đã hiện ở kệ trên (homeShelves) */
const SHELF_CANDIDATES = SHELF_SIZE * 3

function bookCards() {
  return createPublicClient().from('books').select(BOOK_CARD_COLUMNS)
}

type BookCardQuery = ReturnType<typeof bookCards>
type BookCardResult = Awaited<BookCardQuery>

const newestFirst = (query: BookCardQuery) =>
  query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(SHELF_CANDIDATES)

const sharpOnly = (query: BookCardQuery) => query.gte('cover_width', SHARP_COVER_WIDTH)

function rows({ data, error }: BookCardResult, context: string) {
  if (error) throw new Error(`getHomeShelves (${context}): ${error.message}`)
  return data
}

/**
 * Các kệ trang chủ (docs/plans/phase-8.md): Nổi bật (admin chọn), Bán chạy, Mới về (sách tiếng Việt), Sách ngoại văn
 * (cây danh mục `foreignCategoryIds`). Kệ có bìa nét trước (`cover_width`), thiếu thì lấp bằng sách bìa mờ cùng thứ
 * tự. Bán chạy giữ đúng thứ tự số bán. Không sách nào lên hai kệ, Nổi bật ưu tiên sách tiếng Việt (homeShelves). Tất cả
 * query chạy song song.
 * Chỉ sách thuộc danh mục đang hiện (`visibleCategoryIds`): sách đang bán nhưng nằm trong danh mục admin ẩn không lên
 * kệ (trước đây kệ Bán chạy trên CI toàn sách e2e của danh mục ẩn, bị xóa giữa chừng → link chết, prefetch 404).
 */
export async function getHomeShelves(visibleCategoryIds: number[], foreignCategoryIds: number[]) {
  'use cache'
  cacheTag('books')
  cacheLife('hours')

  const visible = new Set(visibleCategoryIds)
  const shelfBooks = () => bookCards().in('category_id', visibleCategoryIds)
  const featured = () => shelfBooks().eq('is_featured', true)
  const vietnamese = () => shelfBooks().eq('language', 'vi')
  const foreign = () => bookCards().in('category_id', foreignCategoryIds.filter((id) => visible.has(id)))

  const featuredVi = () => featured().eq('language', 'vi')

  const [
    featuredViSharp,
    featuredViAll,
    featuredSharp,
    featuredAll,
    bestselling,
    newSharp,
    newAll,
    foreignSharp,
    foreignAll,
  ] = await Promise.all([
    newestFirst(sharpOnly(featuredVi())),
    newestFirst(featuredVi()),
    newestFirst(sharpOnly(featured())),
    newestFirst(featured()),
    shelfBooks()
      .gt('sold_count', 0)
      .order('sold_count', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .limit(SHELF_CANDIDATES),
    newestFirst(sharpOnly(vietnamese())),
    newestFirst(vietnamese()),
    newestFirst(sharpOnly(foreign())),
    newestFirst(foreign()),
  ])

  const shelves = homeShelves(
    {
      featuredVi: { sharp: rows(featuredViSharp, 'featured vi'), all: rows(featuredViAll, 'featured vi') },
      featured: { sharp: rows(featuredSharp, 'featured'), all: rows(featuredAll, 'featured') },
      bestselling: rows(bestselling, 'bestselling'),
      newArrivals: { sharp: rows(newSharp, 'new'), all: rows(newAll, 'new') },
      foreign: { sharp: rows(foreignSharp, 'foreign'), all: rows(foreignAll, 'foreign') },
    },
    SHELF_SIZE,
    SHELF_MIN,
  )
  tagBooks(Object.values(shelves).flat())
  return shelves
}

export type BookCard = Awaited<ReturnType<typeof getHomeShelves>>['newArrivals'][number]

const RANGE_NOT_SATISFIABLE = 'PGRST103'

export type ListBooksInput = {
  /** Danh mục lá (trang danh mục cha truyền id các danh mục con) */
  categoryIds?: number[]
  /** Trang tác giả */
  bookIds?: number[]
  /** Chỉ sách thuộc các danh mục đang hiện này (+ sách không có danh mục): /sach, tìm kiếm, trang tác giả */
  visibleCategoryIds?: number[]
  /** Từ khóa đã qua searchQuerySchema → RPC search_books */
  q?: string
  price?: PriceRange
  lang?: string
  inStock?: boolean
  sort: Sort
  page: number
}

/**
 * Một hàm cho danh mục / tác giả / tìm kiếm. Mọi sort đều kết thúc bằng `id`: sold_count đang toàn 0, thiếu
 * tie-breaker thì Postgres trả thứ tự tùy ý giữa các lần gọi → phân trang lặp/sót sách.
 * `relevance` order tường minh, không dựa vào order bên trong RPC.
 */
export async function listBooks(input: ListBooksInput): Promise<{ books: BookCard[]; total: number }> {
  'use cache'
  cacheTag('books')
  cacheLife('hours')

  const supabase = createPublicClient()
  // RPC: count 'exact' (estimated trên RPC không chính xác). Bảng: 'estimated' (vẫn exact khi dưới ngưỡng max-rows).
  // Order trên kết quả RPC chỉ nhận cột có trong select (PostgREST báo "column books.sold_count does not exist")
  // → thêm cột dùng để sort. Filter thì không cần.
  let query = input.q
    ? supabase.rpc('search_books', { q: input.q }, { count: 'exact' }).select(`${BOOK_CARD_COLUMNS}, sold_count, created_at`)
    : supabase.from('books').select(BOOK_CARD_COLUMNS, { count: 'estimated' })

  if (input.categoryIds) query = query.in('category_id', input.categoryIds)
  if (input.bookIds) query = query.in('id', input.bookIds)
  if (input.visibleCategoryIds) query = query.or(visibleBooksFilter(input.visibleCategoryIds))
  if (input.lang) query = query.eq('language', input.lang)
  if (input.inStock) query = query.gt('stock', 0)
  if (input.price) {
    const { min, max } = PRICE_BOUNDS[input.price]
    if (min !== undefined) query = query.gte('price', min)
    if (max !== undefined) query = query.lt('price', max)
  }

  switch (input.sort) {
    case 'relevance':
    case 'bestselling':
      query = query.order('sold_count', { ascending: false }).order('created_at', { ascending: false }).order('id')
      break
    case 'newest':
      query = query.order('created_at', { ascending: false }).order('id', { ascending: false })
      break
    case 'price-asc':
      query = query.order('price').order('id')
      break
    case 'price-desc':
      query = query.order('price', { ascending: false }).order('id')
      break
  }

  const from = (input.page - 1) * PAGE_SIZE
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)
  // Offset vượt quá số dòng: PostgREST trả 416 thay vì mảng rỗng → coi là trang rỗng (trang gọi notFound)
  if (error?.code === RANGE_NOT_SATISFIABLE) return { books: [], total: count ?? 0 }
  if (error) throw new Error(`listBooks: ${error.message}`)
  tagBooks(data)
  return { books: data, total: count ?? data.length }
}

async function getBookBySlugCached(slug: string) {
  'use cache'
  cacheTag('books')
  cacheLife('hours')

  const { data, error } = await createPublicClient()
    .from('books')
    .select(
      `id, slug, title, subtitle, description, description_en, cover_url, price, original_price, stock, isbn,
       page_count, format, language, published_year, weight_grams, dimensions, category_id, avg_rating, review_count,
       content_warnings, publishers(name), book_authors(role, authors(name, slug))`,
    )
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(`getBookBySlug: ${error.message}`)
  if (data) cacheTag(`book:${data.id}`)
  return data
}

/** React.cache: generateMetadata và page cùng lấy một cuốn trong một request → một lần gọi */
export const getBookBySlug = cache(getBookBySlugCached)

export type BookDetail = NonNullable<Awaited<ReturnType<typeof getBookBySlugCached>>>

/** Kệ "Cùng danh mục" ở trang sách, trừ chính cuốn đang xem */
export async function getRelatedBooks(bookId: number, categoryId: number, limit = 12): Promise<BookCard[]> {
  'use cache'
  cacheTag('books')
  cacheLife('hours')

  const { data, error } = await createPublicClient()
    .from('books')
    .select(BOOK_CARD_COLUMNS)
    .eq('category_id', categoryId)
    .neq('id', bookId)
    .order('sold_count', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')
    .limit(limit)
  if (error) throw new Error(`getRelatedBooks: ${error.message}`)
  tagBooks(data)
  return data
}

async function getAuthorBySlugCached(slug: string) {
  'use cache'
  cacheTag('authors', 'books')
  cacheLife('hours')

  const { data, error } = await createPublicClient()
    .from('authors')
    .select('id, name, slug, bio, bio_en, photo_url, book_authors(book_id)')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(`getAuthorBySlug: ${error.message}`)
  if (!data) return null
  // Một người có thể vừa là tác giả vừa là dịch giả của cùng một cuốn → bỏ trùng
  const { book_authors, ...author } = data
  return { ...author, bookIds: [...new Set(book_authors.map((ba) => ba.book_id))] }
}

export const getAuthorBySlug = cache(getAuthorBySlugCached)

/** Slug cho generateStaticParams: catalog nhỏ → prerender toàn bộ trang sách / tác giả */
export async function getAllBookSlugs() {
  'use cache'
  cacheTag('books')
  cacheLife('hours')

  const { data, error } = await createPublicClient().from('books').select('slug').order('id')
  if (error) throw new Error(`getAllBookSlugs: ${error.message}`)
  return data.map((book) => book.slug)
}

/** Sitemap: slug + ngày sửa + danh mục của mọi sách đang bán (RLS) */
export async function getSitemapBooks() {
  'use cache'
  cacheTag('books')
  cacheLife('hours')

  const { data, error } = await createPublicClient().from('books').select('slug, updated_at, category_id').order('id')
  if (error) throw new Error(`getSitemapBooks: ${error.message}`)
  return data
}

/**
 * Sitemap: slug tác giả + danh mục các sách đang bán của họ (RLS bỏ sách ẩn → embed null), để sitemap.ts bỏ tác giả
 * không còn sách nào lên danh sách (chỉ có sách thuộc danh mục ẩn / không có sách đang bán: trang tác giả rỗng).
 * Tag như getSitemapBooks: `books` (đổi danh mục / tác giả của sách, ẩn / hiện danh mục), `authors` (thêm / sửa tác giả).
 */
export async function getSitemapAuthors() {
  'use cache'
  cacheTag('authors', 'books')
  cacheLife('hours')

  const { data, error } = await createPublicClient()
    .from('authors')
    .select('slug, book_authors(books(category_id))')
    .order('id')
  if (error) throw new Error(`getSitemapAuthors: ${error.message}`)
  return data.map((author) => ({
    slug: author.slug,
    books: author.book_authors.flatMap(({ books }) => (books ? [{ category_id: books.category_id }] : [])),
  }))
}

export async function getAllAuthorSlugs() {
  'use cache'
  cacheTag('authors')
  cacheLife('hours')

  const { data, error } = await createPublicClient().from('authors').select('slug').order('id')
  if (error) throw new Error(`getAllAuthorSlugs: ${error.message}`)
  return data.map((author) => author.slug)
}

const SEARCH_HIT_LIMIT = 8

/** Gợi ý cho command palette: tối đa 8 sách khớp từ khóa (q đã qua searchQuerySchema), bỏ sách thuộc danh mục ẩn. */
export async function searchBookHits(q: string): Promise<SearchHit[]> {
  'use cache'
  cacheTag('books', 'categories')
  cacheLife('hours')

  const categories = await getCategories()
  const { data, error } = await createPublicClient()
    .rpc('search_books', { q })
    .select(
      'id, slug, title, cover_url, category_id, publisher_id, content_warnings, book_authors(role, author_id, authors(name))',
    )
    .or(visibleBooksFilter(visibleCategoryIds(categories)))
    .range(0, SEARCH_HIT_LIMIT - 1)
  if (error) throw new Error(`searchBookHits: ${error.message}`)
  // Admin đổi nhãn / NXB / bìa của một cuốn chỉ làm mới book:{id}: khóa chặn và bìa trong gợi ý phải theo kịp như thẻ sách
  tagBooks(data)

  return data.map((book) => ({
    id: book.id,
    slug: book.slug,
    title: book.title,
    coverUrl: book.cover_url,
    authors: book.book_authors.flatMap((ba) => (ba.role === 'author' && ba.authors ? [ba.authors.name] : [])),
    // Khóa chặn công khai (id số + nhãn): palette che ở client, /api/search không đọc phiên (CDN cache theo URL)
    blockKeys: bookBlockKeys(book),
  }))
}
