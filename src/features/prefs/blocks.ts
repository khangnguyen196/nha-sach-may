import { CONTENT_WARNINGS, type ContentWarning } from '@/features/warnings/labels'

// Chặn theo sở thích (docs/plans/so-thich-canh-bao.md, P-C): một nguồn duy nhất cho "sách nào bị chặn", dùng chung cho
// CSS che thẻ ở danh sách (blockCss), dòng nhắc ở trang sách và chatbot Mây (isBlocked). Chỉ hàm thuần, không
// 'server-only', không zod: thẻ sách (server) và test dùng được.

export type BlockRule =
  | { kind: 'category' | 'author' | 'publisher'; id: number }
  | { kind: 'warning'; warning: ContentWarning }

/** Mục chặn đã mở rộng: danh mục cha → mọi danh mục con (câu 8). Mảng tăng dần, không trùng. */
export type ExpandedBlocks = {
  categoryIds: readonly number[]
  authorIds: readonly number[]
  publisherIds: readonly number[]
  /** string (không phải ContentWarning): blockCss tự kiểm lại, chịu được đầu vào bẩn */
  warnings: readonly string[]
}

/** Cột sách cần để biết sách có bị chặn không (thẻ sách, thẻ chợ sách cũ, trang sách) */
export type BlockableBook = {
  category_id: number | null
  publisher_id: number | null
  content_warnings: readonly string[]
  book_authors: readonly { role: string; author_id: number }[]
}

/** id của DB: số nguyên an toàn > 0 (loại chuỗi, NaN, số âm, số lẻ, 1e21…) */
export function isBlockId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function isContentWarning(value: unknown): value is ContentWarning {
  return typeof value === 'string' && CONTENT_WARNINGS.some((warning) => warning === value)
}

function field(row: object, key: string): unknown {
  return Reflect.get(row, key)
}

/**
 * Một dòng `user_blocks` → mục chặn, hoặc null khi dòng sai (kind lạ, id không phải số nguyên dương, nhãn ngoài enum):
 * bỏ dòng, không throw (dữ liệu DB đã có check, đây là lớp chặn thứ hai trước khi ghép vào CSS).
 */
export function parseBlockRow(row: unknown): BlockRule | null {
  if (typeof row !== 'object' || row === null) return null
  const kind = field(row, 'kind')
  if (kind === 'warning') {
    const warning = field(row, 'warning')
    return isContentWarning(warning) ? { kind, warning } : null
  }
  if (kind !== 'category' && kind !== 'author' && kind !== 'publisher') return null
  const id = field(row, `${kind}_id`)
  return isBlockId(id) ? { kind, id } : null
}

export function parseBlockRows(rows: readonly unknown[]): BlockRule[] {
  return rows.flatMap((row) => {
    const rule = parseBlockRow(row)
    return rule ? [rule] : []
  })
}

const sortedIds = (ids: Iterable<number>) => [...new Set(ids)].filter(isBlockId).sort((a, b) => a - b)

/**
 * Chặn danh mục = chặn chính nó + mọi danh mục con cháu (cây nhiều cấp; dữ liệu vòng không làm lặp vô hạn). Cây lấy từ
 * `categories` truyền vào: danh mục không có trong đó thì con cháu của nó không được mở ra (cây hiện chỉ 2 cấp).
 */
export function expandBlocks(
  rules: readonly BlockRule[],
  categories: readonly { id: number; parent_id: number | null }[],
): ExpandedBlocks {
  const children = new Map<number, number[]>()
  for (const category of categories) {
    if (category.parent_id === null) continue
    children.set(category.parent_id, [...(children.get(category.parent_id) ?? []), category.id])
  }

  const categoryIds = new Set<number>()
  const idsOf = (kind: 'author' | 'publisher') => rules.flatMap((rule) => (rule.kind === kind ? [rule.id] : []))
  for (const rule of rules) {
    if (rule.kind !== 'category') continue
    const queue = [rule.id]
    for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
      if (categoryIds.has(id)) continue
      categoryIds.add(id)
      queue.push(...(children.get(id) ?? []))
    }
  }

  const warnings = new Set(rules.flatMap((rule) => (rule.kind === 'warning' ? [rule.warning] : [])))
  return {
    categoryIds: sortedIds(categoryIds),
    authorIds: sortedIds(idsOf('author')),
    publisherIds: sortedIds(idsOf('publisher')),
    // Thứ tự enum: CSS ổn định giữa các lần render
    warnings: CONTENT_WARNINGS.filter((warning) => warnings.has(warning)),
  }
}

/** Khóa chặn của một cuốn: tác giả chỉ tính vai trò 'author' (câu 9: dịch giả, minh họa không tính) */
export function bookBlockKeys(book: BlockableBook) {
  return {
    categoryId: isBlockId(book.category_id) ? book.category_id : null,
    publisherId: isBlockId(book.publisher_id) ? book.publisher_id : null,
    authorIds: sortedIds(book.book_authors.flatMap((ba) => (ba.role === 'author' ? [ba.author_id] : []))),
    warnings: CONTENT_WARNINGS.filter((warning) => book.content_warnings.includes(warning)),
  }
}

/**
 * Thuộc tính data-* của khung thẻ sách (`[data-book-slot]`), khớp selector của blockCss. Thiếu giá trị → không có
 * thuộc tính (React bỏ undefined). Danh sách cách nhau dấu cách cho `~=`.
 */
export function bookSlotAttributes(book: BlockableBook) {
  const keys = bookBlockKeys(book)
  const list = (values: readonly (number | string)[]) => (values.length > 0 ? values.join(' ') : undefined)
  return {
    'data-book-slot': '',
    'data-c': keys.categoryId === null ? undefined : String(keys.categoryId),
    'data-p': keys.publisherId === null ? undefined : String(keys.publisherId),
    'data-a': list(keys.authorIds),
    'data-w': list(keys.warnings),
  }
}

/** Cùng ngữ nghĩa với selector của blockCss (dòng nhắc trang sách, chatbot Mây) */
export function isBlocked(book: BlockableBook, expanded: ExpandedBlocks): boolean {
  const keys = bookBlockKeys(book)
  return (
    (keys.categoryId !== null && expanded.categoryIds.includes(keys.categoryId)) ||
    (keys.publisherId !== null && expanded.publisherIds.includes(keys.publisherId)) ||
    keys.authorIds.some((id) => expanded.authorIds.includes(id)) ||
    keys.warnings.some((warning) => expanded.warnings.includes(warning))
  )
}

/**
 * CSS che thẻ bị chặn (câu 3). Chỉ ghép số nguyên đã kiểm lại và tên nhãn thuộc enum (câu 3b: không chữ người dùng
 * nhập, không đóng được `</style>`); không có mục nào → chuỗi rỗng (không render <style>). Thẻ bị che: link sách
 * `visibility: hidden` (câu 3a: không nhận Tab, trình đọc màn hình bỏ qua), ô mờ hiện ra; nút "Xem" gắn
 * `data-revealed` vào khung → hết khớp selector.
 */
export function blockCss(expanded: ExpandedBlocks): string {
  const conditions = [
    ...expanded.categoryIds.filter(isBlockId).map((id) => `[data-c="${id}"]`),
    ...expanded.authorIds.filter(isBlockId).map((id) => `[data-a~="${id}"]`),
    ...expanded.publisherIds.filter(isBlockId).map((id) => `[data-p="${id}"]`),
    ...expanded.warnings.filter(isContentWarning).map((warning) => `[data-w~="${warning}"]`),
  ]
  if (conditions.length === 0) return ''
  const slot = `[data-book-slot]:is(${conditions.join(',')}):not([data-revealed])`
  return `${slot}>[data-book-link]{visibility:hidden}${slot}>[data-book-veil]{display:flex}`
}
