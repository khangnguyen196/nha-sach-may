import { z } from 'zod'

// Cùng giới hạn với merge_cart / quote_items (supabase/schema.sql)
export const MAX_QUANTITY = 99
export const MAX_LINES = 100

export const bookIdSchema = z.number().int().positive()
export const quantitySchema = z.number().int().min(1).max(MAX_QUANTITY)

export const cartItemSchema = z.object({ book_id: bookIdSchema, quantity: quantitySchema })
export type CartItem = z.infer<typeof cartItemSchema>

/** Gộp dòng trùng book_id (cộng dồn, chặn MAX_QUANTITY), giữ thứ tự xuất hiện đầu tiên */
export function mergeDuplicates(items: readonly CartItem[]): CartItem[] {
  const merged = new Map<number, number>()
  for (const item of items) {
    merged.set(item.book_id, Math.min((merged.get(item.book_id) ?? 0) + item.quantity, MAX_QUANTITY))
  }
  return [...merged].map(([book_id, quantity]) => ({ book_id, quantity }))
}

/** Giỏ khách: localStorage, tham số của /api/cart/guest, input của mergeGuestCart */
export const cartItemsSchema = z.array(cartItemSchema).max(MAX_LINES).transform(mergeDuplicates)
