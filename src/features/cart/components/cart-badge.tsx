'use client'

import { ShoppingBagIcon } from 'lucide-react'
import { useEffect } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { fillTemplate } from '@/lib/template'
import { setCartSession, useCartCount } from '../store'

export type CartBadgeLabels = { cart: string; withCount: string }

type Props = {
  labels: CartBadgeLabels
  /** null: phiên chưa đọc xong (fallback của Suspense) */
  session: { signedIn: boolean; count: number | null } | null
}

const MAX_SHOWN = 99

/** Icon giỏ ở header. Số = tổng số cuốn: giỏ tài khoản từ server (+ optimistic khi thêm), giỏ khách từ localStorage. */
export function CartBadge({ labels, session }: Props) {
  const signedIn = session?.signedIn
  const serverCount = session?.count ?? null

  useEffect(() => {
    if (signedIn !== undefined) setCartSession(signedIn, serverCount)
  }, [signedIn, serverCount])

  const storeCount = useCartCount()
  // Lần render đầu (kể cả HTML từ server) store chưa có phiên → dùng số server gửi kèm cho người đã đăng nhập
  const count = storeCount ?? (signedIn ? serverCount : null)
  const label = count ? fillTemplate(labels.withCount, { count }) : labels.cart

  return (
    <Link
      href="/cart"
      className={buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'relative text-muted-foreground' })}
    >
      <ShoppingBagIcon aria-hidden />
      <span className="sr-only">{label}</span>
      {/* Tuyệt đối trên icon: hiện / ẩn số không làm xô header */}
      {count ? (
        <span
          aria-hidden
          data-testid="cart-count"
          className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground"
        >
          {count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}
        </span>
      ) : null}
    </Link>
  )
}
