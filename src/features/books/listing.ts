import { resolveSort, type CatalogContext } from './catalog-params'
import type { Category, ListBooksInput } from './queries'
import type { CatalogParams } from './schemas'

/** Tất cả sách / tìm kiếm: chip là danh mục cha; `cat` trong URL nhận cả slug danh mục lá */
export function withCategoryFilter(parsed: CatalogParams, categories: Category[], context: CatalogContext) {
  const parents = categories.filter((c) => c.parent_id === null)
  const selected = categories.find((c) => c.slug === parsed.cat)
  const params = selected ? parsed : { ...parsed, cat: undefined }
  const children = selected ? categories.filter((c) => c.parent_id === selected.id) : []
  const categoryIds = selected ? (children.length > 0 ? children.map((c) => c.id) : [selected.id]) : undefined
  const input: ListBooksInput = {
    q: context === 'search' ? params.q : undefined,
    categoryIds,
    price: params.price,
    lang: params.lang,
    inStock: Boolean(params.stock),
    sort: resolveSort(params, context),
    page: params.page,
  }
  return { params, parents, input }
}
