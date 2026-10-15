'use client'

import type { Locale } from 'next-intl'
import { useOptimistic, useRef, useState, useTransition, type ReactNode } from 'react'
import type { Result } from '@/lib/errors'
import type { CartActionData } from '../actions'
import type { CartLine, CartQuote } from '../queries'
import { setUserCartCount } from '../store'
import { CartView, type CartViewLabels } from './cart-view'

export const QUANTITY_DEBOUNCE_MS = 300

type Change = { bookId: number; quantity: number | 'remove' }

type Props = {
  lines: CartLine[]
  quote: CartQuote
  labels: CartViewLabels
  locale: Locale
  /** setCartQuantity / removeFromCart đã bind locale; cả hai gọi refresh() → props mới về trong cùng transition */
  setQuantity: (bookId: number, quantity: number) => Promise<Result<CartActionData>>
  remove: (bookId: number) => Promise<Result<CartActionData>>
  /** Giỏ rỗng (kể cả sau khi xóa dòng cuối) */
  empty: ReactNode
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function applyChange(lines: CartLine[], change: Change): CartLine[] {
  if (change.quantity === 'remove') return lines.filter((line) => line.book_id !== change.bookId)
  const { quantity } = change
  return lines.map((line) => (line.book_id === change.bookId ? { ...line, quantity } : line))
}

/**
 * Giỏ tài khoản. useOptimistic: số lượng / dòng đổi ngay; transition kết thúc (action xong + refresh) thì về
 * props mới từ server, lỗi thì tự về props cũ (rollback). Bấm liên tục: chỉ lần cuối (sau 300ms) gọi action.
 */
export function UserCart({ lines, quote, labels, locale, setQuantity, remove, empty }: Props) {
  const [optimisticLines, addOptimistic] = useOptimistic(lines, applyChange)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const versions = useRef(new Map<number, number>())

  function change(next: Change) {
    setError(null)
    const version = (versions.current.get(next.bookId) ?? 0) + 1
    versions.current.set(next.bookId, version)

    startTransition(async () => {
      addOptimistic(next)
      if (next.quantity !== 'remove') await wait(QUANTITY_DEBOUNCE_MS)
      // Đã có thay đổi mới hơn cho dòng này → để lần sau gửi
      if (versions.current.get(next.bookId) !== version) return

      const result =
        next.quantity === 'remove' ? await remove(next.bookId) : await setQuantity(next.bookId, next.quantity)
      if (result.ok) setUserCartCount(result.data.count)
      else setError(result.message ?? labels.error)
    })
  }

  if (optimisticLines.length === 0) return empty

  return (
    <CartView
      lines={optimisticLines}
      quote={quote}
      updating={pending}
      error={error}
      labels={labels}
      locale={locale}
      onQuantityChange={(bookId, quantity) => change({ bookId, quantity })}
      onRemove={(bookId) => change({ bookId, quantity: 'remove' })}
    />
  )
}
