'use server'

import { refresh } from 'next/cache'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { getPathname, redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import { withMessage } from '@/lib/error-message'
import { toFailure, type Failure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { parseLocale } from '@/features/auth/schemas'
import { cartLimit, MAX_QUANTITY } from './guest-cart'
import { getCartCount } from './queries'
import { bookIdSchema, cartItemsSchema, quantitySchema } from './schemas'

// locale do page bind sẵn (Server Action không đọc được next/root-params); tham số bind đi qua client nên parse lại.
// user_id lấy từ phiên, không nhận từ client; RLS cart_items_own chặn thêm một lớp.
// Lỗi có tham số (OUT_OF_STOCK: title, stock) dịch sẵn ở đây → client leaf hiện `message`, không cần messages.

/** `count`: tổng số cuốn sau khi đổi (badge); null khi không đếm được */
export type CartActionData = { count: number | null }

const slugSchema = z.string().min(1).max(200)

type Supabase = Awaited<ReturnType<typeof createClient>>

async function fail(locale: Locale, failure: Failure): Promise<Failure> {
  return withMessage(parseLocale(locale), failure)
}

async function unavailable(locale: Locale): Promise<Failure> {
  const t = await getTranslations({ locale: parseLocale(locale), namespace: 'cart' })
  return { ok: false, code: 'BOOK_UNAVAILABLE', message: t('unavailableMessage') }
}

/** Sách đang bán (RLS ẩn sách is_active = false với người không phải admin) + số đang có trong giỏ */
async function loadBookAndLine(supabase: Supabase, userId: string, bookId: number) {
  const [book, line] = await Promise.all([
    supabase.from('books').select('title, stock').eq('id', bookId).eq('is_active', true).maybeSingle(),
    supabase.from('cart_items').select('quantity').eq('user_id', userId).eq('book_id', bookId).maybeSingle(),
  ])
  const error = book.error ?? line.error
  return { error, book: book.data, current: line.data?.quantity ?? 0 }
}

/** Vượt min(stock, 99) → OUT_OF_STOCK kèm tồn kho, hoặc thông báo giới hạn 99 cuốn / sách */
async function overLimit(locale: Locale, book: { title: string; stock: number }): Promise<Failure> {
  if (book.stock < MAX_QUANTITY) {
    return fail(locale, { ok: false, code: 'OUT_OF_STOCK', details: { title: book.title, stock: Math.max(book.stock, 0) } })
  }
  const t = await getTranslations({ locale: parseLocale(locale), namespace: 'cart' })
  return { ok: false, code: 'INVALID_INPUT', message: t('maxPerBook', { max: MAX_QUANTITY }) }
}

async function done(): Promise<Result<CartActionData>> {
  return { ok: true, data: { count: await getCartCount() } }
}

/** Thêm 1 cuốn (cộng dồn). Badge đã cập nhật qua kết quả trả về nên không refresh trang. */
export async function addToCart(locale: Locale, bookId: number): Promise<Result<CartActionData>> {
  const id = bookIdSchema.safeParse(bookId)
  if (!id.success) return fail(locale, { ok: false, code: 'INVALID_INPUT' })
  const user = await getCurrentUser()
  if (!user) return fail(locale, { ok: false, code: 'AUTH_REQUIRED' })

  const supabase = await createClient()
  const { error, book, current } = await loadBookAndLine(supabase, user.id, id.data)
  if (error) return fail(locale, toFailure(error))
  if (!book) return unavailable(locale)
  if (current + 1 > cartLimit(book.stock)) return overLimit(locale, book)

  const { error: upsertError } = await supabase
    .from('cart_items')
    .upsert({ user_id: user.id, book_id: id.data, quantity: current + 1 }, { onConflict: 'user_id,book_id' })
  if (upsertError) return fail(locale, toFailure(upsertError))
  return done()
}

/** Đổi số lượng ở trang giỏ. Giảm luôn được (kể cả khi đang vượt tồn kho); tăng thì kiểm tra min(stock, 99). */
export async function setCartQuantity(locale: Locale, bookId: number, quantity: number): Promise<Result<CartActionData>> {
  const id = bookIdSchema.safeParse(bookId)
  const qty = quantitySchema.safeParse(quantity)
  if (!id.success || !qty.success) return fail(locale, { ok: false, code: 'INVALID_INPUT' })
  const user = await getCurrentUser()
  if (!user) return fail(locale, { ok: false, code: 'AUTH_REQUIRED' })

  const supabase = await createClient()
  const { error, book, current } = await loadBookAndLine(supabase, user.id, id.data)
  if (error) return fail(locale, toFailure(error))
  if (!book) return unavailable(locale)
  if (qty.data > current && qty.data > cartLimit(book.stock)) return overLimit(locale, book)

  // Dòng đã bị xóa ở tab khác → 0 dòng được sửa; refresh để danh sách khớp DB
  const { error: updateError } = await supabase
    .from('cart_items')
    .update({ quantity: qty.data })
    .eq('user_id', user.id)
    .eq('book_id', id.data)
  if (updateError) return fail(locale, toFailure(updateError))
  refresh()
  return done()
}

export async function removeFromCart(locale: Locale, bookId: number): Promise<Result<CartActionData>> {
  const id = bookIdSchema.safeParse(bookId)
  if (!id.success) return fail(locale, { ok: false, code: 'INVALID_INPUT' })
  const user = await getCurrentUser()
  if (!user) return fail(locale, { ok: false, code: 'AUTH_REQUIRED' })

  const supabase = await createClient()
  const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id).eq('book_id', id.data)
  if (error) return fail(locale, toFailure(error))
  refresh()
  return done()
}

/** Gộp giỏ localStorage vào giỏ tài khoản (CartSync, ngay sau khi có phiên). Client tự refresh sau khi xóa localStorage. */
export async function mergeGuestCart(items: unknown): Promise<Result<CartActionData>> {
  const parsed = cartItemsSchema.safeParse(items)
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' }
  if (!(await getCurrentUser())) return { ok: false, code: 'AUTH_REQUIRED' }
  if (parsed.data.length === 0) return done()

  const supabase = await createClient()
  const { error } = await supabase.rpc('merge_cart', { p_items: parsed.data })
  if (error) return toFailure(error)
  return done()
}

/**
 * Nút "Thêm vào giỏ" khi chưa có JS (form POST): khách → đăng nhập rồi quay lại trang sách;
 * đã đăng nhập → thêm rồi sang trang giỏ (trang giỏ cho thấy kết quả, kể cả khi không thêm được).
 * Có JS thì nút tự xử lý (giỏ khách ở localStorage), không gọi action này.
 */
export async function addToCartFromForm(locale: Locale, bookId: number, slug: string): Promise<void> {
  const safeLocale = parseLocale(locale)
  if (!(await getCurrentUser())) {
    const parsedSlug = slugSchema.safeParse(slug)
    const next = parsedSlug.success
      ? getPathname({ href: { pathname: '/books/[slug]', params: { slug: parsedSlug.data } }, locale: safeLocale })
      : undefined
    redirect({ href: { pathname: '/login', query: next ? { next } : {} }, locale: safeLocale })
  }
  const result = await addToCart(safeLocale, bookId)
  if (!result.ok) console.error('addToCartFromForm:', result.code)
  redirect({ href: '/cart', locale: safeLocale })
}
