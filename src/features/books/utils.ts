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
