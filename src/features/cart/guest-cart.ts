// Hàm thuần cho giỏ khách vãng lai, chạy ở cả client. KHÔNG import zod: zod vào bundle client tốn ~30KB gzip
// (ngân sách JS trang sách, CLAUDE.md). Server Action parse bằng schemas.ts (zod); guest-cart.test.ts kiểm tra
// normalizeCartItems và cartItemsSchema cho cùng kết quả. Đọc/ghi localStorage nằm ở store.ts.

// Cùng giới hạn với merge_cart / quote_items (supabase/schema.sql)
export const MAX_QUANTITY = 99
export const MAX_LINES = 100

export type CartItem = { book_id: number; quantity: number }

/** Gộp dòng trùng book_id (cộng dồn, chặn MAX_QUANTITY), giữ thứ tự xuất hiện đầu tiên */
export function mergeDuplicates(items: readonly CartItem[]): CartItem[] {
  const merged = new Map<number, number>()
  for (const item of items) {
    merged.set(item.book_id, Math.min((merged.get(item.book_id) ?? 0) + item.quantity, MAX_QUANTITY))
  }
  return [...merged].map(([book_id, quantity]) => ({ book_id, quantity }))
}

const isBookId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0
const isQuantity = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= MAX_QUANTITY

/** Giỏ hợp lệ (mảng ≤ MAX_LINES, book_id nguyên dương, quantity 1–99) → đã gộp trùng; sai một chỗ → null */
export function normalizeCartItems(value: unknown): CartItem[] | null {
  if (!Array.isArray(value) || value.length > MAX_LINES) return null
  const entries: unknown[] = value
  const items: CartItem[] = []
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) return null
    const bookId: unknown = Reflect.get(entry, 'book_id')
    const quantity: unknown = Reflect.get(entry, 'quantity')
    if (!isBookId(bookId) || !isQuantity(quantity)) return null
    items.push({ book_id: bookId, quantity })
  }
  return mergeDuplicates(items)
}

/** JSON hỏng / sai dạng → giỏ rỗng (lần lưu sau ghi đè) */
export function parseGuestCart(raw: string | null): CartItem[] {
  if (!raw) return []
  try {
    return normalizeCartItems(JSON.parse(raw)) ?? []
  } catch {
    return []
  }
}

/** Số cuốn tối đa của một sách trong giỏ */
export function cartLimit(stock: number) {
  return Math.max(0, Math.min(stock, MAX_QUANTITY))
}

export function countItems(items: readonly CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export type AddStatus = 'added' | 'limit' | 'full'

/** Thêm 1 cuốn. `limit` = cartLimit(stock). 'limit': đã đủ số cuốn của sách này; 'full': giỏ đã đủ số đầu sách. */
export function addItem(items: readonly CartItem[], bookId: number, limit: number): { items: CartItem[]; status: AddStatus } {
  const existing = items.find((item) => item.book_id === bookId)
  if (existing) {
    if (existing.quantity >= limit) return { items: [...items], status: 'limit' }
    return {
      items: items.map((item) => (item.book_id === bookId ? { ...item, quantity: item.quantity + 1 } : item)),
      status: 'added',
    }
  }
  if (limit < 1) return { items: [...items], status: 'limit' }
  if (items.length >= MAX_LINES) return { items: [...items], status: 'full' }
  return { items: [...items, { book_id: bookId, quantity: 1 }], status: 'added' }
}

/** Đổi số lượng (chặn 1–MAX_QUANTITY). Sách chưa có trong giỏ → giữ nguyên. */
export function setItemQuantity(items: readonly CartItem[], bookId: number, quantity: number): CartItem[] {
  const clamped = Math.min(Math.max(Math.trunc(quantity), 1), MAX_QUANTITY)
  return items.map((item) => (item.book_id === bookId ? { ...item, quantity: clamped } : item))
}

export function removeItem(items: readonly CartItem[], bookId: number): CartItem[] {
  return items.filter((item) => item.book_id !== bookId)
}

// Tham số `items` của /api/cart/guest: "12x2,15x1". Sắp theo book_id để cùng giỏ → cùng URL (cache dùng lại được).

export function serializeItemsParam(items: readonly CartItem[]) {
  return [...items]
    .sort((a, b) => a.book_id - b.book_id)
    .map((item) => `${item.book_id}x${item.quantity}`)
    .join(',')
}

const ITEM_PARAM = /^([1-9]\d{0,15})x([1-9]\d?)$/

/** Sai định dạng (kể cả một phần tử) → null để route trả 400 */
export function parseItemsParam(value: string | null): CartItem[] | null {
  if (value === null || value === '') return []
  const items: CartItem[] = []
  for (const part of value.split(',')) {
    const match = ITEM_PARAM.exec(part)
    if (!match) return null
    items.push({ book_id: Number(match[1]), quantity: Number(match[2]) })
  }
  return normalizeCartItems(items)
}
