import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { cache } from 'react'
import { visibleBooksFilter } from '@/features/books/utils'
import { createPublicClient } from '@/lib/supabase/public'
import { MARKET_PAGE_SIZE, type MarketListInput } from './market-params'
import { signUsedPhotoUrls } from './signed-urls'

// Chá»£ sÃ¡ch cÅ©, pháº§n cÃ´ng khai (docs/plans/cho-sach-cu.md, P-B vÃ²ng 9). Client anon khÃ´ng cookies â†’ dÃ¹ng Ä‘Æ°á»£c trong
// 'use cache'; RLS cho anon chá»‰ Ä‘á»c tin Ä‘Ã£ duyá»‡t / Ä‘Ã£ bÃ¡n, chá»‰ cÃ¡c cá»™t Ä‘Æ°á»£c cáº¥p (khÃ´ng seller_id, fee, reject_reason).
// Tin cá»§a sÃ¡ch ngá»«ng bÃ¡n khÃ´ng hiá»‡n: danh sÃ¡ch embed `books!inner` (bá» dÃ²ng), trang tin embed thÆ°á»ng rá»“i tráº£ null khi
// khÃ´ng Ä‘á»c Ä‘Æ°á»£c sÃ¡ch (RLS cá»§a books). Quyáº¿t Ä‘á»‹nh 7a: hÃ m nÃ o cÃ³ link áº£nh kÃ½ (háº¡n 7 ngÃ y) giá»¯ cacheLife('hours')
// (expire 1 ngÃ y); Vitest cache-life.test.ts kiá»ƒm.

const RANGE_NOT_SATISFIABLE = 'PGRST103'

/** Tag cá»§a tá»«ng sÃ¡ch trong danh sÃ¡ch: admin áº©n / sá»­a sÃ¡ch (book:{id}) thÃ¬ danh sÃ¡ch Ä‘ang chá»©a sÃ¡ch Ä‘Ã³ lÃ m má»›i */
function tagBooks(bookIds: readonly number[]) {
  if (bookIds.length > 0) cacheTag(...new Set(bookIds.map((id) => `book:${id}`)))
}

/**
 * Danh sÃ¡ch tin Ä‘ang bÃ¡n (chá»‰ `approved`; tin Ä‘Ã£ bÃ¡n khÃ´ng lÃªn danh sÃ¡ch, quyáº¿t Ä‘á»‹nh 5) theo bá»™ lá»c cá»§a URL. áº¢nh Ä‘áº§u
 * má»—i tin kÃ½ báº±ng anon. Trang vÆ°á»£t quÃ¡ â†’ máº£ng rá»—ng (trang hiá»‡n InlineNotFound).
 */
export async function listMarketListings(input: MarketListInput) {
  'use cache'
  cacheTag('used-listings')
  cacheLife('hours')

  const supabase = createPublicClient()
  let query = supabase
    .from('used_listings')
    // Cá»™t cháº·n theo sá»Ÿ thÃ­ch (category_id, publisher_id, content_warnings, tÃ¡c giáº£) láº¥y tá»« sÃ¡ch catalog cá»§a tin, khÃ´ng tá»«
    // used_listings (anon khÃ´ng Ä‘á»c seller_id / fee / reject_reason)
    .select(
      'id, condition, price, photos, seller_name, approved_at, books!inner(id, slug, title, category_id, publisher_id, content_warnings, book_authors(role, author_id))',
      { count: 'exact' },
    )
    .eq('status', 'approved')
  // Lá»c trÃªn sÃ¡ch nhÃºng `!inner`: tin khÃ´ng khá»›p bá»‹ bá» khá»i danh sÃ¡ch (khÃ´ng chá»‰ Ä‘á»ƒ books null)
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

/** max_rows cá»§a PostgREST (1000): catalog ~250 cuá»‘n nÃªn má»™t trang Ä‘á»§ chá»©a má»i sÃ¡ch khá»›p; vÆ°á»£t thÃ¬ sÃ¡ch sau bá»‹ bá» */
const SEARCH_BOOK_ID_LIMIT = 1000

/**
 * Tab SÃ¡ch cÅ© cá»§a trang tÃ¬m kiáº¿m, bÆ°á»›c 1: id cÃ¡c sÃ¡ch khá»›p tá»« khÃ³a (RPC search_books nhÆ° tab SÃ¡ch má»›i, gÃµ khÃ´ng dáº¥u)
 * thuá»™c danh má»¥c Ä‘ang hiá»‡n (quyáº¿t Ä‘á»‹nh 10). KhÃ´ng gáº¯n tag tá»«ng sÃ¡ch: sÃ¡ch bá»‹ áº©n / ngá»«ng bÃ¡n sau Ä‘Ã³ bá»‹ bÆ°á»›c 2
 * (listMarketListings / countUsedListings, `books!inner` + tag book:{id}) bá» ra; sÃ¡ch má»›i khá»›p / hiá»‡n láº¡i lÃ m má»›i tag
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
 * NhÃ£n "SÃ¡ch cÅ© (N)" á»Ÿ tab SÃ¡ch má»›i: sá»‘ tin Ä‘ang bÃ¡n cá»§a cÃ¡c sÃ¡ch `bookIds` (cÃ¹ng Ä‘iá»u kiá»‡n vá»›i listMarketListings:
 * `approved` + `books!inner` bá» tin cá»§a sÃ¡ch ngá»«ng bÃ¡n). KHÃ”NG kÃ½ link áº£nh.
 * Äá»c dÃ²ng (`book_id`) kÃ¨m count exact thay vÃ¬ head count: chá»‰ gáº¯n tag book:{id} cho sÃ¡ch CÃ“ tin (khÃ´ng pháº£i má»i sÃ¡ch
 * khá»›p tá»« khÃ³a: Next bá» tag thá»© 129 trá»Ÿ Ä‘i kÃ¨m cáº£nh bÃ¡o). SÃ¡ch khá»›p mÃ  khÃ´ng cÃ³ tin bá»‹ áº©n â†’ sá»‘ khÃ´ng Ä‘á»•i; sÃ¡ch cÃ³
 * tin bá»‹ áº©n â†’ tag cá»§a nÃ³ lÃ m má»›i; tin má»›i duyá»‡t / rÃºt â†’ tag `used-listings`.
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
 * Má»™t tin cÃ´ng khai: Ä‘Ã£ duyá»‡t hoáº·c Ä‘Ã£ bÃ¡n (nhÃ£n "ÄÃ£ bÃ¡n"), má»i áº£nh kÃ½ báº±ng anon (áº£nh khÃ´ng cÃ²n â†’ url null). Tin cá»§a
 * sÃ¡ch thuá»™c danh má»¥c áº©n váº«n xem Ä‘Æ°á»£c báº±ng link trá»±c tiáº¿p (nhÆ° trang sÃ¡ch); sÃ¡ch ngá»«ng bÃ¡n â†’ null.
 */
async function getMarketListingCached(id: number) {
  'use cache'
  cacheTag(`used-listing:${id}`)
  cacheLife('hours')

  const supabase = createPublicClient()
  // NhÃºng sÃ¡ch KHÃ”NG `!inner`: tin cá»§a sÃ¡ch ngá»«ng bÃ¡n váº«n ra dÃ²ng (books null do RLS cá»§a books) Ä‘á»ƒ biáº¿t book_id
  const { data, error } = await supabase
    .from('used_listings')
    .select('id, book_id, condition, price, description, photos, status, seller_name, approved_at, books(id, slug, title)')
    .eq('id', id)
    .in('status', ['approved', 'sold'])
    .maybeSingle()
  if (error) throw new Error(`getMarketListing: ${error.message}`)
  if (!data) return null
  // Gáº¯n tag sÃ¡ch cáº£ khi sÃ¡ch ngá»«ng bÃ¡n (tráº£ null bÃªn dÆ°á»›i): admin báº­t láº¡i sÃ¡ch (updateTag book:{id}) â†’ trang tin hiá»‡n láº¡i
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

/** React.cache: generateMetadata vÃ  page cÃ¹ng láº¥y má»™t tin trong má»™t request â†’ má»™t láº§n gá»i */
export const getMarketListing = cache(getMarketListingCached)

export type MarketListingDetail = NonNullable<Awaited<ReturnType<typeof getMarketListingCached>>>

/**
 * "CÃ³ N báº£n cÅ© tá»« X â‚«" á»Ÿ trang sÃ¡ch: sá»‘ tin Ä‘ang bÃ¡n + giÃ¡ tháº¥p nháº¥t cá»§a má»™t cuá»‘n. KHÃ”NG kÃ½ link áº£nh. CÃ¹ng profile
 * 'hours' vá»›i getBookBySlug cá»§a trang sÃ¡ch â†’ cáº¥u hÃ¬nh cache cá»§a trang sÃ¡ch khÃ´ng ngáº¯n Ä‘i.
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
