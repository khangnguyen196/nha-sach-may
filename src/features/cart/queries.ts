import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

// Giỏ tài khoản: client theo phiên (cookies) → chỉ gọi trong <Suspense>, không cache chung.
// RLS cart_items_own giới hạn về giỏ của chính người dùng.

const CART_COLUMNS =
  'book_id, quantity, books(slug, title, cover_url, price, original_price, stock, is_active, book_authors(role, authors(name)))'

async function selectCart() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cart_items')
    .select(CART_COLUMNS)
    .order('created_at')
    .order('book_id')
  if (error) throw new Error(`getCart: ${error.message}`)
  return data
}

type CartRow = Awaited<ReturnType<typeof selectCart>>[number]
type CartRowBook = NonNullable<CartRow['books']>

/** Dòng giỏ gửi xuống client (giỏ tài khoản và giỏ khách cùng kiểu). `book` null = ngừng bán / không còn. */
export type CartLine = {
  book_id: number
  quantity: number
  book: (Omit<CartRowBook, 'is_active' | 'book_authors'> & { authors: string[] }) | null
}

/** Dùng chung với dòng giỏ khách (/api/cart/guest) */
export function toCartLine(bookId: number, quantity: number, book: CartRowBook | null): CartLine {
  if (!book || !book.is_active) return { book_id: bookId, quantity, book: null }
  const authors = book.book_authors.flatMap((ba) => (ba.role === 'author' && ba.authors ? [ba.authors.name] : []))
  const { slug, title, cover_url, price, original_price, stock } = book
  return { book_id: bookId, quantity, book: { slug, title, cover_url, price, original_price, stock, authors } }
}

export async function getCart(): Promise<CartLine[]> {
  const rows = await selectCart()
  return rows.map((row) => toCartLine(row.book_id, row.quantity, row.books))
}

/** Tổng số cuốn (badge). null khi query lỗi: header vẫn hiện icon, không hiện số sai. */
export async function getCartCount(): Promise<number | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('cart_items').select('quantity')
  if (error) {
    console.error('getCartCount:', error.message)
    return null
  }
  return data.reduce((sum, row) => sum + row.quantity, 0)
}

/** Tạm tính dùng chung giỏ tài khoản (quote_order) và giỏ khách (quote_items); voucher thuộc Phase 9 */
export type CartQuote = Omit<Database['public']['Functions']['quote_order']['Returns'][number], 'discount'>

export async function getCartQuote(): Promise<CartQuote> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('quote_order').single()
  if (error) throw new Error(`getCartQuote: ${error.message}`)
  return {
    item_count: data.item_count,
    subtotal: data.subtotal,
    shipping_fee: data.shipping_fee,
    total: data.total,
    free_ship_from: data.free_ship_from,
  }
}
