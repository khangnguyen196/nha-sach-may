import { PRICE_BOUNDS } from '@/features/books/catalog-params'
import { PRICE_RANGES, type PriceRange } from '@/features/books/schemas'

/**
 * Tag cache catalog cần làm mới sau một thay đổi ở admin (action gọi `updateTag` cho từng tag).
 * - `book:{id}`: trang sách + mọi danh sách ĐANG chứa sách đó (danh sách gắn tag theo từng sách trả về).
 * - `books`: mọi danh sách sách. Chỉ cần khi sách có thể vào một danh sách CHƯA chứa nó (hiện lại, đổi danh mục,
 *   slug, tác giả, nổi bật, chữ dùng để tìm kiếm, ngôn ngữ, khoảng giá của bộ lọc, còn / hết hàng): danh sách đó không
 *   có tag của sách. Sửa giá trong cùng khoảng, tồn kho vẫn còn hàng, mô tả, bìa… chỉ cần `book:{id}`.
 * - `categories`: danh sách danh mục (menu, trang danh mục); thêm `books` khi ẩn / hiện / đổi cha (trang danh mục cha
 *   lọc theo id các danh mục con).
 * - Tác giả: `authors` + `book:{id}` các sách của tác giả (tên tác giả hiện trên thẻ sách).
 */

export type BookSnapshot = {
  id: number
  slug: string
  title: string
  subtitle: string | null
  isbn: string | null
  language: string
  category_id: number | null
  price: number
  stock: number
  is_active: boolean
  is_featured: boolean
  /** `author_id:role`, thứ tự bất kỳ */
  authors: string[]
}

export type CategorySnapshot = { parent_id: number | null; is_active: boolean }

export type CatalogChange =
  | { kind: 'book'; before: BookSnapshot; after: BookSnapshot }
  | { kind: 'category'; before: CategorySnapshot | null; after: CategorySnapshot }
  | { kind: 'author'; bookIds: number[] }

const LIST_KEYS = ['slug', 'title', 'subtitle', 'isbn', 'language', 'category_id', 'is_featured'] as const

/** Khoảng giá của bộ lọc (PRICE_BOUNDS) chứa giá này */
function priceRangeOf(price: number): PriceRange | undefined {
  return PRICE_RANGES.find((range) => {
    const { min, max } = PRICE_BOUNDS[range]
    return (min === undefined || price >= min) && (max === undefined || price < max)
  })
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join()

function bookEntersNewLists(before: BookSnapshot, after: BookSnapshot) {
  if (!before.is_active) return after.is_active
  return (
    LIST_KEYS.some((key) => before[key] !== after[key]) ||
    !sameSet(before.authors, after.authors) ||
    priceRangeOf(before.price) !== priceRangeOf(after.price) ||
    before.stock > 0 !== after.stock > 0
  )
}

export function catalogTagsFor(change: CatalogChange): string[] {
  switch (change.kind) {
    case 'book': {
      const { before, after } = change
      // Ẩn trước và sau: sách không có trên trang công khai nào, chỉ cần dọn cache của chính nó
      const tags = [`book:${after.id}`]
      if (after.is_active && bookEntersNewLists(before, after)) tags.push('books')
      return tags
    }
    case 'category': {
      const { before, after } = change
      const affectsBooks = before !== null && (before.is_active !== after.is_active || before.parent_id !== after.parent_id)
      return affectsBooks ? ['categories', 'books'] : ['categories']
    }
    case 'author':
      return ['authors', ...change.bookIds.map((id) => `book:${id}`)]
  }
}
