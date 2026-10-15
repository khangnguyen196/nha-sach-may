import { z } from 'zod'
import { MAX_LINES, MAX_QUANTITY, mergeDuplicates } from './guest-cart'

// Input của Server Action (chỉ server). Client không import file này: zod vào bundle client ~30KB gzip;
// giỏ khách ở client kiểm tra bằng normalizeCartItems (guest-cart.ts), test đảm bảo hai bên khớp nhau.

export const bookIdSchema = z.number().int().positive()
export const quantitySchema = z.number().int().min(1).max(MAX_QUANTITY)

const cartItemSchema = z.object({ book_id: bookIdSchema, quantity: quantitySchema })

/** Giỏ localStorage gửi lên mergeGuestCart: ≤ 100 dòng, gộp trùng book_id */
export const cartItemsSchema = z.array(cartItemSchema).max(MAX_LINES).transform(mergeDuplicates)
