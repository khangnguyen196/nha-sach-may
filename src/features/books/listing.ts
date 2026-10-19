import { resolveSort, type CatalogContext } from './catalog-params'
import type { Category, ListBooksInput } from './queries'
import type { CatalogParams } from './schemas'
import { visibleCategoryIds } from './utils'

/**
 * Tất cả sách / tìm kiếm: chip là danh mục cha; `cat` trong URL nhận cả slug danh mục lá. Chỉ danh mục đang hiện
 * (`visibleCategoryIds`): `cat` là danh mục con của gốc ẩn thì bỏ qua; không `cat` thì loại sách thuộc danh mục ẩn
 * (docs/plans/sau-ux.md mục 6).
 */
export function withCategoryFilter(parsed: CatalogParams, categories: Category[], context: CatalogContext) {
  const visibleIds = visibleCategoryIds(categories)
  const visible = categories.filter((c) => visibleIds.includes(c.id))
  const parents = visible.filter((c) => c.parent_id === null)
  const selected = visible.find((c) => c.slug === parsed.cat)
  const params = selected ? parsed : { ...parsed, cat: undefined }
  const children = selected ? visible.filter((c) => c.parent_id === selected.id) : []
  const categoryIds = selected ? (children.length > 0 ? children.map((c) => c.id) : [selected.id]) : undefined
  const input: ListBooksInput = {
    q: context === 'search' ? params.q : undefined,
    categoryIds,
    // Đã chọn danh mục (luôn đang hiện) thì categoryIds đủ hẹp
    visibleCategoryIds: selected ? undefined : visibleIds,
    price: params.price,
    lang: params.lang,
    inStock: Boolean(params.stock),
    sort: resolveSort(params, context),
    page: params.page,
  }
  return { params, parents, input }
}
