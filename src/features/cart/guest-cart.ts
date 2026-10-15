import { cartItemsSchema, MAX_LINES, MAX_QUANTITY, type CartItem } from './schemas'

// Hàm thuần cho giỏ khách vãng lai. Đọc/ghi localStorage nằm ở store.ts (chỉ chạy ở client).

/** JSON hỏng / sai dạng → giỏ rỗng (lần lưu sau ghi đè) */
export function parseGuestCart(raw: string | null): CartItem[] {
  if (!raw) return []
  try {
    const parsed = cartItemsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
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
  const parsed = cartItemsSchema.safeParse(items)
  return parsed.success ? parsed.data : null
}
