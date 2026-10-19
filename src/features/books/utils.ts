/**
 * Kệ trang chủ: sách bìa nét trước, rồi lấp cho đủ `limit` bằng danh sách thường (cùng điều kiện, cùng thứ tự; có thể
 * chứa lại sách bìa nét → bỏ trùng theo id). Kệ không ngắn đi khi có ít sách bìa nét.
 */
export function fillShelf<T extends { id: number }>(sharp: readonly T[], all: readonly T[], limit: number): T[] {
  const seen = new Set<number>()
  const out: T[] = []
  for (const book of [...sharp, ...all]) {
    if (out.length === limit) break
    if (seen.has(book.id)) continue
    seen.add(book.id)
    out.push(book)
  }
  return out
}

/** % giảm so với giá gốc, làm tròn; không giảm (hoặc dữ liệu lạ) → null */
export function discountPercent(price: number, originalPrice: number | null): number | null {
  if (!originalPrice || originalPrice <= price) return null
  const percent = Math.round((1 - price / originalPrice) * 100)
  return percent > 0 ? percent : null
}

export type PageItem = number | 'ellipsis'

/**
 * Dãy số trang rút gọn: luôn có trang đầu, trang cuối và `siblings` trang hai bên trang hiện tại.
 * Chỗ hở 1 trang thì hiện luôn số trang thay vì dấu "…" (dấu "…" thay cho một số thì không gọn hơn).
 *
 *   paginationRange(5, 10) → [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]
 */
export function paginationRange(current: number, total: number, siblings = 1): PageItem[] {
  if (total <= 0) return []
  const pages = new Set([1, total])
  for (let page = current - siblings; page <= current + siblings; page++) {
    if (page >= 1 && page <= total) pages.add(page)
  }
  const sorted = [...pages].sort((a, b) => a - b)
  const items: PageItem[] = []
  for (const [index, page] of sorted.entries()) {
    const previous = sorted[index - 1]
    if (previous !== undefined && page - previous === 2) items.push(previous + 1)
    else if (previous !== undefined && page - previous > 2) items.push('ellipsis')
    items.push(page)
  }
  return items
}

/** Mô tả từ Google Books: đoạn cách nhau bằng dòng trống; dòng đơn giữ trong cùng đoạn */
export function splitParagraphs(text: string | null): string[] {
  if (!text) return []
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

/** Rút gọn cho meta description: gộp khoảng trắng, cắt ở ranh giới từ, thêm "…" khi bị cắt */
export function truncateText(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  const cut = normalized.slice(0, max - 1)
  // Ký tự ngay sau chỗ cắt là khoảng trắng → từ cuối đã trọn; không thì lùi về khoảng trắng gần nhất
  const endsOnWord = normalized[max - 1] === ' '
  const lastSpace = cut.lastIndexOf(' ')
  const head = endsOnWord || lastSpace <= max / 2 ? cut : cut.slice(0, lastSpace)
  return `${head.replace(/[\s,.;:!?-]+$/, '')}…`
}

/**
 * Danh mục khách đang thấy: danh sách công khai (RLS chỉ trả danh mục đang hiện) bỏ danh mục con có cha đang ẩn. Sách
 * thuộc danh mục ngoài cây này không lên kệ trang chủ (admin ẩn một nhánh thì sách của nhánh đó cũng biến khỏi kệ).
 */
export function visibleCategoryIds(categories: { id: number; parent_id: number | null }[]) {
  const ids = new Set(categories.map((category) => category.id))
  return categories
    .filter((category) => category.parent_id === null || ids.has(category.parent_id))
    .map((category) => category.id)
}

/**
 * Quy tắc ẩn danh mục (docs/plans/sau-ux.md mục 6, A1): sách thuộc danh mục không hiện (`visibleCategoryIds`) không lên
 * danh sách nào (lưới, tìm kiếm, palette, chatbot, trang tác giả); link trực tiếp vẫn xem / mua được. Sách không có
 * danh mục (`category_id` null) giữ nguyên như trước (★6c chưa quyết). Bộ lọc `or` của PostgREST cho bảng / kết quả RPC.
 */
export function visibleBooksFilter(visibleIds: readonly number[]) {
  return visibleIds.length > 0 ? `category_id.is.null,category_id.in.(${visibleIds.join(',')})` : 'category_id.is.null'
}

/** Như visibleBooksFilter nhưng lọc trong bộ nhớ (catalog rút gọn của chatbot) */
export function inVisibleCategories<T extends { category_id: number | null }>(
  books: readonly T[],
  categories: { id: number; parent_id: number | null }[],
): T[] {
  const visible = new Set(visibleCategoryIds(categories))
  return books.filter((book) => book.category_id === null || visible.has(book.category_id))
}
