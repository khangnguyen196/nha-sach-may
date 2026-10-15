import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { placeholder } from '@/lib/template'
import { getCartCount } from '../queries'
import { CartBadge, type CartBadgeLabels } from './cart-badge'
import { CartSync } from './cart-sync'

/** Icon giỏ ở header. Đọc phiên trong Suspense (header vẫn prerender); fallback = icon chưa có số. */
export async function CartLink() {
  const [tLayout, tCart] = await Promise.all([getTranslations('layout'), getTranslations('cart')])
  const labels: CartBadgeLabels = { cart: tLayout('cart'), withCount: tCart('badgeLabel', { count: placeholder('count') }) }

  return (
    <Suspense fallback={<CartBadge labels={labels} session={null} />}>
      <CartStatus labels={labels} />
    </Suspense>
  )
}

async function CartStatus({ labels }: { labels: CartBadgeLabels }) {
  const user = await getCurrentUser()
  if (!user) return <CartBadge labels={labels} session={{ signedIn: false, count: 0 }} />

  const count = await getCartCount()
  return (
    <>
      <CartBadge labels={labels} session={{ signedIn: true, count }} />
      <CartSync />
    </>
  )
}
