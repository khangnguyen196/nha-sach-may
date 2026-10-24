import type { Category } from '@/features/books/queries'
import { visibleCategoryIds } from '@/features/books/utils'

// Tham số URL của Chợ sách cũ (/cho-sach-cu): tên và cách dùng như bộ lọc của /sach (`cat`, `sort`, `page`) cộng `book`
// (slug sách: dòng "Có N bản cũ" ở trang sách trỏ tới đây). Parse ở server bằng marketParamsSchema (schemas.ts).

export const MARKET_SORTS = ['newest', 'price-asc', 'price-desc'] as const
export type MarketSort = (typeof MARKET_SORTS)[number]
export const DEFAULT_MARKET_SORT: MarketSort = 'newest'

/** Số tin mỗi trang (= lưới /sach) */
export const MARKET_PAGE_SIZE = 24

export type MarketParams = {
  cat?: string | undefined
  book?: string | undefined
  sort?: MarketSort | undefined
  page: number
}

/** Đổi bất cứ thứ gì khác `page` → về trang 1 (như withParams của catalog) */
export function withMarketParams(current: MarketParams, patch: Partial<MarketParams>): MarketParams {
  const resetsPage = !('page' in patch)
  return { ...current, ...patch, ...(resetsPage && { page: 1 }) }
}

/** Tham số → query của Link; bỏ giá trị mặc định để mỗi trạng thái chỉ có một URL */
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

/** Đầu vào của listMarketListings (public-queries.ts): cũng là khóa cache */
export type MarketListInput = {
  /** Danh mục lá đã chọn (danh mục cha → các lá con) */
  categoryIds?: number[] | undefined
  /** Không chọn danh mục: chỉ sách thuộc danh mục đang hiện (+ sách không có danh mục), như /sach */
  visibleCategoryIds?: number[] | undefined
  bookSlug?: string | undefined
  sort: MarketSort
  page: number
}

/**
 * Như withCategoryFilter của /sach: chip là danh mục cha đang hiện; `cat` nhận cả slug danh mục lá. `cat` là danh mục
 * ẩn / không có thì bỏ qua; không `cat` thì loại tin của sách thuộc danh mục ẩn (quyết định 10).
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
