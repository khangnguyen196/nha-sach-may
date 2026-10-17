import 'server-only'
import { resolveSort, type CatalogContext } from './catalog-params'
import { getAuthorBySlug, getCategories, listBooks, type Category, type ListBooksInput } from './queries'
import { catalogParamsSchema, type CatalogParams } from './schemas'

// Tham số lọc của từng trang lưới → input của listBooks. Trang và /api/catalog/page-exists (proxy hỏi trước khi
// render ?page= > 1) dùng chung các hàm này: cùng input → cùng mục cache của listBooks, quyết định 404 không lệch trang.

type RawParams = Record<string, string | string[] | undefined>

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

/** Danh mục: `cat` chỉ nhận danh mục con của chính danh mục này; slug khác → bỏ qua như không có */
export function withSubcategoryFilter(parsed: CatalogParams, category: Category, subcategories: Category[]) {
  const selected = subcategories.find((c) => c.slug === parsed.cat)
  const params = selected ? parsed : { ...parsed, cat: undefined }
  // Sách chỉ gắn vào danh mục lá: danh mục cha lọc theo id các danh mục con
  const categoryIds = selected ? [selected.id] : subcategories.length > 0 ? subcategories.map((c) => c.id) : [category.id]
  const input: ListBooksInput = {
    categoryIds,
    price: params.price,
    lang: params.lang,
    inStock: Boolean(params.stock),
    sort: resolveSort(params, 'browse'),
    page: params.page,
  }
  return { params, input }
}

/** Tác giả: không có bộ lọc, chỉ giữ sort và trang. Không có sách → không query (input null) */
export function authorListing(parsed: CatalogParams, bookIds: number[]) {
  const params = { sort: parsed.sort, page: parsed.page }
  const input: ListBooksInput | null =
    bookIds.length > 0 ? { bookIds, sort: resolveSort(params, 'browse'), page: params.page } : null
  return { params, input }
}

export type ListingKind = 'books' | 'search' | 'category' | 'author'

async function listingInput(kind: ListingKind, slug: string, parsed: CatalogParams) {
  switch (kind) {
    case 'books':
      return withCategoryFilter(parsed, await getCategories(), 'browse').input
    case 'search':
      // Không có từ khóa: trang chỉ hiện gợi ý, không có lưới
      return parsed.q ? withCategoryFilter(parsed, await getCategories(), 'search').input : undefined
    case 'category': {
      const categories = await getCategories()
      const category = categories.find((c) => c.slug === slug)
      if (!category) return undefined
      const subcategories = categories.filter((c) => c.parent_id === category.id)
      return withSubcategoryFilter(parsed, category, subcategories).input
    }
    case 'author': {
      const author = await getAuthorBySlug(slug)
      return author ? authorListing(parsed, author.bookIds).input : undefined
    }
  }
}

/**
 * Trang `?page=` của một lưới có sách không. Trang 1, slug không tồn tại (slug guard của proxy lo) hoặc tìm kiếm
 * không từ khóa → true: chỉ trang > 1 rỗng mới là trang không tồn tại, như trang tự kiểm.
 */
export async function listingPageExists(kind: ListingKind, slug: string, raw: RawParams): Promise<boolean> {
  const parsed = catalogParamsSchema.parse(raw)
  if (parsed.page === 1) return true
  const input = await listingInput(kind, slug, parsed)
  if (input === undefined) return true
  if (input === null) return false
  return (await listBooks(input)).books.length > 0
}
