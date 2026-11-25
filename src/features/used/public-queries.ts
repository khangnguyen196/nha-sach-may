import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { cache } from 'react'
import { visibleBooksFilter } from '@/features/books/utils'
import { createPublicClient } from '@/lib/supabase/public'
import { MARKET_PAGE_SIZE, type MarketListInput } from './market-params'
import { signUsedPhotoUrls } from './signed-urls'

// Chợ sách cũ, phần công khai (docs/plans/cho-sach-cu.md, P-B vòng 9). Client anon không cookies → dùng được trong
// 'use cache'; RLS cho anon chỉ đọc tin đã duyệt / đã bán, chỉ các cột được cấp (không seller_id, fee, reject_reason).
// Tin của sách ngừng bán không hiện: danh sách embed `books!inner` (bỏ dòng), trang tin embed thường rồi trả null khi
// không đọc được sách (RLS của books). Quyết định 7a: hàm nào có link ảnh ký (hạn 7 ngày) giữ cacheLife('hours')
// (expire 1 ngày); Vitest cache-life.test.ts kiểm.

const RANGE_NOT_SATISFIABLE = 'PGRST103'

/** Tag của từng sách trong danh sách: admin ẩn / sửa sách (book:{id}) thì danh sách đang chứa sách đó làm mới */
function tagBooks(bookIds: readonly number[]) {
  if (bookIds.length > 0) cacheTag(...new Set(bookIds.map((id) => `book:${id}`)))
}

/**
 * Danh sách tin đang bán (chỉ `approved`; tin đã bán không lên danh sách, quyết định 5) theo bộ lọc của URL. Ảnh đầu
 * mỗi tin ký bằng anon. Trang vượt quá → mảng rỗng (trang hiện InlineNotFound).
 */
export async function listMarketListings(input: MarketListInput) {
  'use cache'
  cacheTag('used-listings')
  cacheLife('hours')

  const supabase = createPublicClient()
  let query = supabase
    .from('used_listings')
    // Cột chặn theo sở thích (category_id, publisher_id, content_warnings, tác giả) lấy từ sách catalog của tin, không từ
    // used_listings (anon không đọc seller_id / fee / reject_reason)
    .select(
      'id, condition, price, photos, seller_name, approved_at, books!inner(id, slug, title, category_id, publisher_id, content_warnings, book_authors(role, author_id))',
      { count: 'exact' },
    )
    .eq('status', 'approved')
  // Lọc trên sách nhúng `!inner`: tin không khớp bị bỏ khỏi danh sách (không chỉ để books null)
  if (input.categoryIds) query = query.in('books.category_id', input.categoryIds)
  if (input.visibleCategoryIds) query = query.or(visibleBooksFilter(input.visibleCategoryIds), { referencedTable: 'books' })
  if (input.bookSlug) query = query.eq('books.slug', input.bookSlug)
  if (input.bookIds) query = query.in('book_id', input.bookIds)

  switch (input.sort) {
    case 'newest':
      query = query.order('approved_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
      break
    case 'price-asc':
      query = query.order('price').order('id')
      break
    case 'price-desc':
      query = query.order('price', { ascending: false }).order('id')
      break
  }

  const from = (input.page - 1) * MARKET_PAGE_SIZE
  const { data, count, error } = await query.range(from, from + MARKET_PAGE_SIZE - 1)
  if (error?.code === RANGE_NOT_SATISFIABLE) return { listings: [], total: count ?? 0 }
  if (error) throw new Error(`listMarketListings: ${error.message}`)
  tagBooks(data.map((listing) => listing.books.id))

  const urls = await signUsedPhotoUrls(
    supabase,
    data.map((listing) => listing.photos[0] ?? ''),
  )
  return {
    listings: data.map((listing, index) => ({
      id: listing.id,
      book: {
        slug: listing.books.slug,
        title: listing.books.title,
        category_id: listing.books.category_id,
        publisher_id: listing.books.publisher_id,
        content_warnings: listing.books.content_warnings,
        book_authors: listing.books.book_authors,
      },
      condition: listing.condition,
      price: listing.price,
      sellerName: listing.seller_name,
      photoUrl: urls[index] ?? null,
    })),
    total: count ?? data.length,
  }
}

export type MarketListing = Awaited<ReturnType<typeof listMarketListings>>['listings'][number]

/** max_rows của PostgREST (1000): catalog ~250 cuốn nên một trang đủ chứa mọi sách khớp; vượt thì sách sau bị bỏ */
const SEARCH_BOOK_ID_LIMIT = 1000

/**
 * Tab Sách cũ của trang tìm kiếm, bước 1: id các sách khớp từ khóa (RPC search_books như tab Sách mới, gõ không dấu)
 * thuộc danh mục đang hiện (quyết định 10). Không gắn tag từng sách: sách bị ẩn / ngừng bán sau đó bị bước 2
 * (listMarketListings / countUsedListings, `books!inner` + tag book:{id}) bỏ ra; sách mới khớp / hiện lại làm mới tag
 * `books` / `categories`.
 */
export async function matchingUsedSearchBookIds(q: string, visibleIds: number[]) {
  'use cache'
  cacheTag('books', 'categories')
  cacheLife('hours')

  const { data, error } = await createPublicClient()
    .rpc('search_books', { q })
    .select('id')
    .or(visibleBooksFilter(visibleIds))
    .order('id')
    .range(0, SEARCH_BOOK_ID_LIMIT - 1)
  if (error) throw new Error(`matchingUsedSearchBookIds: ${error.message}`)
  return data.map((book) => book.id)
}

/**
 * Nhãn "Sách cũ (N)" ở tab Sách mới: số tin đang bán của các sách `bookIds` (cùng điều kiện với listMarketListings:
 * `approved` + `books!inner` bỏ tin của sách ngừng bán). KHÔNG ký link ảnh.
 * Đọc dòng (`book_id`) kèm count exact thay vì head count: chỉ gắn tag book:{id} cho sách CÓ tin (không phải mọi sách
 * khớp từ khóa: Next bỏ tag thứ 129 trở đi kèm cảnh báo). Sách khớp mà không có tin bị ẩn → số không đổi; sách có
 * tin bị ẩn → tag của nó làm mới; tin mới duyệt / rút → tag `used-listings`.
 */
export async function countUsedListings(bookIds: number[]) {
  'use cache'
  cacheTag('used-listings')
  cacheLife('hours')

  const { data, count, error } = await createPublicClient()
    .from('used_listings')
    .select('book_id, books!inner(id)', { count: 'exact' })
    .eq('status', 'approved')
    .in('book_id', bookIds)
  if (error) throw new Error(`countUsedListings: ${error.message}`)
  tagBooks(data.map((listing) => listing.book_id))
  return count ?? data.length
}

/**
 * Một tin công khai: đã duyệt hoặc đã bán (nhãn "Đã bán"), mọi ảnh ký bằng anon (ảnh không còn → url null). Tin của
 * sách thuộc danh mục ẩn vẫn xem được bằng link trực tiếp (như trang sách); sách ngừng bán → null.
 */
async function getMarketListingCached(id: number) {
  'use cache'
  cacheTag(`used-listing:${id}`)
  cacheLife('hours')

  const supabase = createPublicClient()
  // Nhúng sách KHÔNG `!inner`: tin của sách ngừng bán vẫn ra dòng (books null do RLS của books) để biết book_id
  const { data, error } = await supabase
    .from('used_listings')
    .select('id, book_id, condition, price, description, photos, status, seller_name, approved_at, books(id, slug, title)')
    .eq('id', id)
    .in('status', ['approved', 'sold'])
    .maybeSingle()
  if (error) throw new Error(`getMarketListing: ${error.message}`)
  if (!data) return null
  // Gắn tag sách cả khi sách ngừng bán (trả null bên dưới): admin bật lại sách (updateTag book:{id}) → trang tin hiện lại
  tagBooks([data.book_id])
  if (!data.books) return null

  const urls = await signUsedPhotoUrls(supabase, data.photos)
  return {
    id: data.id,
    book: { id: data.books.id, slug: data.books.slug, title: data.books.title },
    condition: data.condition,
    price: data.price,
    description: data.description,
    photos: data.photos.map((path, index) => ({ path, url: urls[index] ?? null })),
    sold: data.status === 'sold',
    sellerName: data.seller_name,
    approvedAt: data.approved_at,
  }
}

/** React.cache: generateMetadata và page cùng lấy một tin trong một request → một lần gọi */
export const getMarketListing = cache(getMarketListingCached)

export type MarketListingDetail = NonNullable<Awaited<ReturnType<typeof getMarketListingCached>>>

/**
 * "Có N bản cũ từ X ₫" ở trang sách: số tin đang bán + giá thấp nhất của một cuốn. KHÔNG ký link ảnh. Cùng profile
 * 'hours' với getBookBySlug của trang sách → cấu hình cache của trang sách không ngắn đi.
 */
export async function getUsedCopies(bookId: number) {
  'use cache'
  cacheTag(`used-book:${bookId}`)
  cacheLife('hours')

  const { data, count, error } = await createPublicClient()
    .from('used_listings')
    .select('price', { count: 'exact' })
    .eq('book_id', bookId)
    .eq('status', 'approved')
    .order('price')
    .limit(1)
  if (error) throw new Error(`getUsedCopies: ${error.message}`)
  const [cheapest] = data
  return cheapest && count ? { count, minPrice: cheapest.price } : null
}
