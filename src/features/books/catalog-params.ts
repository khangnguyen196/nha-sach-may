import type { CatalogParams, PriceRange, Sort } from './schemas'

export const PAGE_SIZE = 24

/** Ngữ cảnh trang: `relevance` chỉ có ở tìm kiếm; danh mục/tác giả mặc định bán chạy */
export type CatalogContext = 'browse' | 'search'

export const sortsFor = (context: CatalogContext): Sort[] =>
  context === 'search'
    ? ['relevance', 'bestselling', 'newest', 'price-asc', 'price-desc']
    : ['bestselling', 'newest', 'price-asc', 'price-desc']

export const defaultSort = (context: CatalogContext): Sort => (context === 'search' ? 'relevance' : 'bestselling')

/** Sort hợp lệ cho ngữ cảnh, sai ngữ cảnh (VD `relevance` ở danh mục) → mặc định */
export function resolveSort(params: CatalogParams, context: CatalogContext): Sort {
  return params.sort && sortsFor(context).includes(params.sort) ? params.sort : defaultSort(context)
}

/** Khoảng giá theo nghìn đồng trong URL → khoảng VND [min, max) */
export const PRICE_BOUNDS: Record<PriceRange, { min?: number; max?: number }> = {
  '0-100': { max: 100_000 },
  '100-200': { min: 100_000, max: 200_000 },
  '200-300': { min: 200_000, max: 300_000 },
  '300-up': { min: 300_000 },
}

/**
 * Áp thay đổi lên tham số hiện tại. Đổi bất cứ thứ gì khác `page` → về trang 1, để không rơi vào
 * trang không tồn tại của tập kết quả mới.
 */
export function withParams(current: CatalogParams, patch: Partial<CatalogParams>): CatalogParams {
  const resetsPage = !('page' in patch)
  return { ...current, ...patch, ...(resetsPage && { page: 1 }) }
}

/** Tham số → query của Link. Bỏ giá trị mặc định để mỗi trạng thái chỉ có một URL. */
export function toQuery(params: CatalogParams, context: CatalogContext): Record<string, string> {
  const query: Record<string, string> = {}
  if (params.q) query.q = params.q
  if (params.cat) query.cat = params.cat
  if (params.price) query.price = params.price
  if (params.lang) query.lang = params.lang
  if (params.stock) query.stock = params.stock
  const sort = resolveSort(params, context)
  if (sort !== defaultSort(context)) query.sort = sort
  if (params.page > 1) query.page = String(params.page)
  return query
}

export const hasFilters = (params: CatalogParams) =>
  Boolean(params.cat || params.price || params.lang || params.stock)

/** Trang gốc của một lưới catalog; query do toQuery sinh */
export type CatalogBase =
  | { pathname: '/categories/[slug]'; params: { slug: string } }
  | { pathname: '/authors/[slug]'; params: { slug: string } }
  | { pathname: '/search' }

export function catalogHref(base: CatalogBase, params: CatalogParams, context: CatalogContext) {
  return { ...base, query: toQuery(params, context) }
}
