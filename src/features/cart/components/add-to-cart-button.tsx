'use client'

import { ShoppingBagIcon } from 'lucide-react'
import { useState, useTransition, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Link, useRouter } from '@/i18n/navigation'
import type { Result } from '@/lib/errors'
import type { CartActionData } from '../actions'
import { addItem } from '../guest-cart'
import { beginUserAdd, endUserAdd, getCartMode, readGuestCart, setUserCartCount, writeGuestCart } from '../store'

export type AddToCartLabels = {
  add: string
  adding: string
  added: string
  viewCart: string
  limitReached: string
  cartFull: string
  storageError: string
  error: string
}

type Props = {
  bookId: number
  /** min(stock, 99) lúc render trang; server kiểm tra lại */
  limit: number
  labels: AddToCartLabels
  /** addToCart đã bind locale + bookId */
  add: () => Promise<Result<CartActionData>>
  /** addToCartFromForm đã bind: dùng khi chưa có JS (form POST) */
  formAction: () => Promise<void>
}

type Status = { kind: 'added' } | { kind: 'error'; message: string } | null

/**
 * Thêm 1 cuốn mỗi lần bấm. Khách → localStorage; đã đăng nhập → Server Action. Chưa biết phiên (header chưa
 * stream xong) → thử action, nhận AUTH_REQUIRED thì ghi localStorage.
 */
export function AddToCartButton({ bookId, limit, labels, add, formAction }: Props) {
  const [status, setStatus] = useState<Status>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function addAsGuest() {
    const next = addItem(readGuestCart(), bookId, limit)
    if (next.status === 'limit') return setStatus({ kind: 'error', message: labels.limitReached })
    if (next.status === 'full') return setStatus({ kind: 'error', message: labels.cartFull })
    if (!writeGuestCart(next.items)) return setStatus({ kind: 'error', message: labels.storageError })
    setStatus({ kind: 'added' })
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const mode = getCartMode()
    if (mode === 'guest') return addAsGuest()

    startTransition(async () => {
      if (mode === 'user') beginUserAdd()
      const result = await add()
      if (mode === 'user') endUserAdd(result.ok ? result.data.count : null)
      else if (result.ok) {
        setUserCartCount(result.data.count)
        // Header có thể stream tới sau với số render trước lúc thêm, ghi đè số này → lấy lại header
        router.refresh()
      }

      if (result.ok) return setStatus({ kind: 'added' })
      if (result.code === 'AUTH_REQUIRED') return addAsGuest()
      setStatus({ kind: 'error', message: result.message ?? labels.error })
    })
  }

  return (
    <form action={formAction} onSubmit={onSubmit}>
      <Button type="submit" size="lg" className="h-11 w-full px-6 text-base sm:w-auto" aria-disabled={pending}>
        <ShoppingBagIcon aria-hidden />
        {pending ? labels.adding : labels.add}
      </Button>
      {/* Giữ sẵn một dòng: thông báo hiện ra không đẩy nội dung bên dưới */}
      <p role="status" className="mt-2 min-h-6 text-sm">
        {status?.kind === 'added' && (
          <>
            <span className="text-success">{labels.added}</span>
            <span aria-hidden className="mx-1.5 text-subtle">
              ·
            </span>
            <Link
              href="/cart"
              className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {labels.viewCart}
            </Link>
          </>
        )}
        {status?.kind === 'error' && <span className="text-sale">{status.message}</span>}
      </p>
    </form>
  )
}
