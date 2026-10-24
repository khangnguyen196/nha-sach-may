import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { cache } from 'react'
import { visibleBooksFilter } from '@/features/books/utils'
import { createPublicClient } from '@/lib/supabase/public'
import { MARKET_PAGE_SIZE, type MarketListInput } from './market-params'
import { signUsedPhotoUrls } from './signed-urls'

// Chợ sách cũ, phần công khai (docs/plans/cho-sach-cu.md, P-B vòng 9). Client anon không cookies → dùng được trong
// 'use cache'; RLS cho anon chỉ đọc tin đã duyệt / đã bán, chỉ các cột được cấp (không seller_id, fee, reject_reason)
// và chỉ sách đang bán (embed `books!inner` bỏ tin của sách ngừng bán). Quyết định 7a: hàm nào có link ảnh ký (hạn 7
// ngày) giữ cacheLife('hours') (expire 1 ngày); Vitest cache-life.test.ts kiểm.

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
    .select('id, condition, price, photos, seller_name, approved_at, books!inner(id, slug, title, category_id)', {
      count: 'exact',
    })
    .eq('status', 'approved')
  // Lọc trên sách nhúng `!inner`: tin không khớp bị bỏ khỏi danh sách (không chỉ để books null)
  if (input.categoryIds) query = query.in('books.category_id', input.categoryIds)
  if (input.visibleCategoryIds) query = query.or(visibleBooksFilter(input.visibleCategoryIds), { referencedTable: 'books' })
  if (input.bookSlug) query = query.eq('books.slug', input.bookSlug)

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
      book: { slug: listing.books.slug, title: listing.books.title },
      condition: listing.condition,
      price: listing.price,
      sellerName: listing.seller_name,
      photoUrl: urls[index] ?? null,
    })),
    total: count ?? data.length,
  }
}

export type MarketListing = Awaited<ReturnType<typeof listMarketListings>>['listings'][number]

/**
 * Một tin công khai: đã duyệt hoặc đã bán (nhãn "Đã bán"), mọi ảnh ký bằng anon (ảnh không còn → url null). Tin của
 * sách thuộc danh mục ẩn vẫn xem được bằng link trực tiếp (như trang sách); sách ngừng bán → null.
 */
async function getMarketListingCached(id: number) {
  'use cache'
  cacheTag(`used-listing:${id}`)
  cacheLife('hours')

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('used_listings')
    .select('id, condition, price, description, photos, status, seller_name, approved_at, books!inner(id, slug, title)')
    .eq('id', id)
    .in('status', ['approved', 'sold'])
    .maybeSingle()
  if (error) throw new Error(`getMarketListing: ${error.message}`)
  if (!data) return null
  tagBooks([data.books.id])

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
