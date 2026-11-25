import type { Category } from '@/features/books/queries'
import { visibleCategoryIds } from '@/features/books/utils'

// Tham sá»‘ URL cá»§a Chá»£ sÃ¡ch cÅ© (/cho-sach-cu): tÃªn vÃ  cÃ¡ch dÃ¹ng nhÆ° bá»™ lá»c cá»§a /sach (`cat`, `sort`, `page`) cá»™ng `book`
// (slug sÃ¡ch: dÃ²ng "CÃ³ N báº£n cÅ©" á»Ÿ trang sÃ¡ch trá» tá»›i Ä‘Ã¢y). Parse á»Ÿ server báº±ng marketParamsSchema (schemas.ts).

export const MARKET_SORTS = ['newest', 'price-asc', 'price-desc'] as const
export type MarketSort = (typeof MARKET_SORTS)[number]
export const DEFAULT_MARKET_SORT: MarketSort = 'newest'

/** Sá»‘ tin má»—i trang (= lÆ°á»›i /sach) */
export const MARKET_PAGE_SIZE = 24

export type MarketParams = {
  cat?: string | undefined
  book?: string | undefined
  sort?: MarketSort | undefined
  page: number
}

/** Äá»•i báº¥t cá»© thá»© gÃ¬ khÃ¡c `page` â†’ vá» trang 1 (nhÆ° withParams cá»§a catalog) */
export function withMarketParams(current: MarketParams, patch: Partial<MarketParams>): MarketParams {
  const resetsPage = !('page' in patch)
  return { ...current, ...patch, ...(resetsPage && { page: 1 }) }
}

/** Tham sá»‘ â†’ query cá»§a Link; bá» giÃ¡ trá»‹ máº·c Ä‘á»‹nh Ä‘á»ƒ má»—i tráº¡ng thÃ¡i chá»‰ cÃ³ má»™t URL */
export function marketQuery(params: MarketParams): Record<string, string> {
  const query: Record<string, string> = {}
  if (params.cat) query.cat = params.cat
  if (params.book) query.book = params.book
  if (params.sort && params.sort !== DEFAULT_MARKET_SORT) query.sort = params.sort
  if (params.page > 1) query.page = String(params.page)
  return query
}

export function marketHref(params: MarketParams) {
  return { pathname: '/used-books', query: marketQuery(params) } as const
}

/** Äáº§u vÃ o cá»§a listMarketListings (public-queries.ts): cÅ©ng lÃ  khÃ³a cache */
export type MarketListInput = {
  /** Danh má»¥c lÃ¡ Ä‘Ã£ chá»n (danh má»¥c cha â†’ cÃ¡c lÃ¡ con) */
  categoryIds?: number[] | undefined
  /** KhÃ´ng chá»n danh má»¥c: chá»‰ sÃ¡ch thuá»™c danh má»¥c Ä‘ang hiá»‡n (+ sÃ¡ch khÃ´ng cÃ³ danh má»¥c), nhÆ° /sach */
  visibleCategoryIds?: number[] | undefined
  bookSlug?: string | undefined
  /** Tab SÃ¡ch cÅ© cá»§a trang tÃ¬m kiáº¿m: chá»‰ tin cá»§a cÃ¡c sÃ¡ch nÃ y (id tá»« matchingUsedSearchBookIds) */
  bookIds?: number[] | undefined
  sort: MarketSort
  page: number
}

// ---------- Tab SÃ¡ch má»›i | SÃ¡ch cÅ© cá»§a trang tÃ¬m kiáº¿m (/tim-kiem?type=used) ----------

export type SearchTab = 'new' | 'used'

type RawSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/** `type=used` (giÃ¡ trá»‹ Ä‘áº§u) â†’ tab SÃ¡ch cÅ©; má»i giÃ¡ trá»‹ khÃ¡c / khÃ´ng cÃ³ â†’ tab SÃ¡ch má»›i (máº·c Ä‘á»‹nh, nhÆ° trÆ°á»›c) */
export function parseSearchTab(raw: RawSearchParams): SearchTab {
  return firstValue(raw.type) === 'used' ? 'used' : 'new'
}

/** Tham sá»‘ cá»§a tab SÃ¡ch má»›i giá»¯ láº¡i khi Ä‘á»•i tab (tab SÃ¡ch cÅ© khÃ´ng dÃ¹ng nhÆ°ng váº«n Ä‘á»ƒ trÃªn URL Ä‘á»ƒ quay láº¡i) */
const KEPT_PARAMS = ['sort', 'price', 'lang', 'cat', 'stock'] as const

/**
 * Query cá»§a trang tÃ¬m kiáº¿m cho má»™t tab: giá»¯ q Ä‘Ãºng chá»¯ ngÆ°á»i dÃ¹ng gÃµ (khÃ´ng pháº£i q Ä‘Ã£ chuáº©n hÃ³a chá»¯ thÆ°á»ng) + bá»™ lá»c /
 * sáº¯p xáº¿p cá»§a tab SÃ¡ch má»›i; bá» `page` (trang cá»§a tab kia khÃ´ng cÃ³ nghÄ©a á»Ÿ tab nÃ y); tab SÃ¡ch cÅ© thÃªm `type=used`.
 */
export function searchTabQuery(raw: RawSearchParams, tab: SearchTab): Record<string, string> {
  const query: Record<string, string> = {}
  const q = firstValue(raw.q)?.trim()
  if (q) query.q = q
  for (const key of KEPT_PARAMS) {
    const value = firstValue(raw[key])
    if (value) query[key] = value
  }
  if (tab === 'used') query.type = 'used'
  return query
}

export function searchTabHref(raw: RawSearchParams, tab: SearchTab) {
  return { pathname: '/search', query: searchTabQuery(raw, tab) } as const
}

/**
 * NhÆ° withCategoryFilter cá»§a /sach: chip lÃ  danh má»¥c cha Ä‘ang hiá»‡n; `cat` nháº­n cáº£ slug danh má»¥c lÃ¡. `cat` lÃ  danh má»¥c
 * áº©n / khÃ´ng cÃ³ thÃ¬ bá» qua; khÃ´ng `cat` thÃ¬ loáº¡i tin cá»§a sÃ¡ch thuá»™c danh má»¥c áº©n (quyáº¿t Ä‘á»‹nh 10).
 */
export function marketFilter(parsed: MarketParams, categories: Category[]) {
  const visibleIds = visibleCategoryIds(categories)
  const visible = categories.filter((category) => visibleIds.includes(category.id))
  const parents = visible.filter((category) => category.parent_id === null)
  const selected = visible.find((category) => category.slug === parsed.cat)
  const params = selected ? parsed : { ...parsed, cat: undefined }
  const children = selected ? visible.filter((category) => category.parent_id === selected.id) : []
  const input: MarketListInput = {
    categoryIds: selected ? (children.length > 0 ? children.map((c) => c.id) : [selected.id]) : undefined,
    visibleCategoryIds: selected ? undefined : visibleIds,
    bookSlug: params.book,
    sort: params.sort ?? DEFAULT_MARKET_SORT,
    page: params.page,
  }
  return { params, parents, input }
}
