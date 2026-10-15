import type { CartQuote } from './queries'

/** Đổi số lượng liên tục: chỉ gửi lên server khi người dùng dừng tay chừng này */
export const QUANTITY_DEBOUNCE_MS = 300

export type FreeShipStatus = { reached: boolean; remaining: number; progress: number }

/** Thanh mốc freeship, số lấy từ quote (quote_order / quote_items), không hard-code mốc */
export function freeShipStatus(quote: Pick<CartQuote, 'subtotal' | 'free_ship_from'>): FreeShipStatus {
  const threshold = Math.max(quote.free_ship_from, 0)
  const remaining = Math.max(threshold - quote.subtotal, 0)
  return {
    reached: remaining === 0,
    remaining,
    progress: threshold === 0 ? 1 : Math.min(quote.subtotal / threshold, 1),
  }
}
