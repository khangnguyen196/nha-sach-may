'use client'

import type { Locale } from 'next-intl'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { removeItem, serializeItemsParam, setItemQuantity } from '../guest-cart'
import type { CartLine, CartQuote } from '../queries'
import { readGuestCart, useGuestCart, writeGuestCart } from '../store'
import { CartSkeleton } from './cart-skeleton'
import { QUANTITY_DEBOUNCE_MS } from '../utils'
import { CartView, type CartViewLabels } from './cart-view'

type Props = {
  labels: CartViewLabels
  errorLabels: { message: string; retry: string; storage: string }
  locale: Locale
  empty: ReactNode
}

type Loaded = { key: string; books: Map<number, CartLine['book']>; quote: CartQuote }

const subscribeNothing = () => () => {}

function isQuote(value: unknown): value is CartQuote {
  if (typeof value !== 'object' || value === null) return false
  return ['item_count', 'subtotal', 'shipping_fee', 'total', 'free_ship_from'].every(
    (key) => typeof Reflect.get(value, key) === 'number',
  )
}

function isLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false
  const book: unknown = Reflect.get(value, 'book')
  return (
    typeof Reflect.get(value, 'book_id') === 'number' &&
    typeof Reflect.get(value, 'quantity') === 'number' &&
    (book === null ||
      (typeof book === 'object' &&
        typeof Reflect.get(book, 'slug') === 'string' &&
        typeof Reflect.get(book, 'title') === 'string' &&
        typeof Reflect.get(book, 'price') === 'number' &&
        typeof Reflect.get(book, 'stock') === 'number' &&
        Array.isArray(Reflect.get(book, 'authors'))))
  )
}

/** Phản hồi của /api/cart/guest ({ ok, data: { lines, quote } }); dạng lạ → null (hiện lỗi tải) */
function parseResponse(json: unknown): { lines: CartLine[]; quote: CartQuote } | null {
  if (typeof json !== 'object' || json === null || Reflect.get(json, 'ok') !== true) return null
  const data: unknown = Reflect.get(json, 'data')
  if (typeof data !== 'object' || data === null) return null
  const lines: unknown = Reflect.get(data, 'lines')
  const quote: unknown = Reflect.get(data, 'quote')
  if (!Array.isArray(lines) || !isQuote(quote)) return null
  const entries: unknown[] = lines
  return entries.every(isLine) ? { lines: entries.filter(isLine), quote } : null
}

/**
 * Giỏ khách: số lượng ở localStorage (đổi ngay, không cần rollback), thông tin sách + tạm tính lấy lại từ server
 * (/api/cart/guest → quote_items) sau mỗi thay đổi, debounce 300ms. Trong lúc chờ, tóm tắt mờ đi.
 */
export function GuestCart({ labels, errorLabels, locale, empty }: Props) {
  const items = useGuestCart()
  // Server không đọc được localStorage → skeleton tới khi hydrate, tránh nháy "giỏ rỗng"
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [storageError, setStorageError] = useState(false)
  const hasLoaded = useRef(false)
  const key = serializeItemsParam(items)

  useEffect(() => {
    if (key === '') return
    const controller = new AbortController()
    // Lần tải đầu không chờ; các lần sau (đổi số lượng liên tục) chỉ gọi khi người dùng dừng tay
    const timer = setTimeout(
      async () => {
        try {
          const response = await fetch(`/api/cart/guest?items=${encodeURIComponent(key)}`, { signal: controller.signal })
          const parsed = response.ok ? parseResponse(await response.json()) : null
          if (!parsed) throw new Error(`/api/cart/guest: ${response.status}`)
          hasLoaded.current = true
          setLoaded({ key, books: new Map(parsed.lines.map((line) => [line.book_id, line.book])), quote: parsed.quote })
          setFailed(false)
        } catch (error) {
          if (controller.signal.aborted) return
          console.error(error)
          setFailed(true)
        }
      },
      hasLoaded.current ? QUANTITY_DEBOUNCE_MS : 0,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, attempt])

  function update(next: ReturnType<typeof readGuestCart>) {
    setStorageError(!writeGuestCart(next))
  }

  if (!hydrated) return <CartSkeleton />
  if (items.length === 0) return empty

  if (!loaded) {
    return failed ? (
      <LoadError labels={errorLabels} onRetry={() => setAttempt((n) => n + 1)} />
    ) : (
      <CartSkeleton lines={Math.min(items.length, 4)} />
    )
  }

  // Sách vừa thêm ở tab khác, chưa có thông tin → hiện khi lần tải tới xong
  const lines: CartLine[] = items.flatMap((item) => {
    const book = loaded.books.get(item.book_id)
    return book === undefined ? [] : [{ book_id: item.book_id, quantity: item.quantity, book }]
  })
  const error = storageError ? errorLabels.storage : null

  return (
    <>
      {failed && <LoadError labels={errorLabels} onRetry={() => setAttempt((n) => n + 1)} compact />}
      <CartView
        lines={lines}
        quote={loaded.quote}
        updating={loaded.key !== key}
        error={error}
        labels={labels}
        locale={locale}
        onQuantityChange={(bookId, quantity) => update(setItemQuantity(readGuestCart(), bookId, quantity))}
        onRemove={(bookId) => update(removeItem(readGuestCart(), bookId))}
      />
    </>
  )
}

function LoadError({
  labels,
  onRetry,
  compact = false,
}: {
  labels: Props['errorLabels']
  onRetry: () => void
  compact?: boolean
}) {
  return (
    <div
      role="alert"
      className={
        compact
          ? 'mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm'
          : 'mt-8 flex flex-col items-center rounded-lg border border-dashed px-6 py-16 text-center'
      }
    >
      <p className={compact ? 'text-sale' : 'max-w-sm text-muted-foreground'}>{labels.message}</p>
      <Button variant="outline" size="lg" className={compact ? 'h-9 px-3' : 'mt-6 h-10 px-4'} onClick={onRetry}>
        {labels.retry}
      </Button>
    </div>
  )
}
