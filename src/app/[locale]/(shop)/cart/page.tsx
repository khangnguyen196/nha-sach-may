import { ShoppingBagIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/features/books/components/empty-state'
import { removeFromCart, setCartQuantity } from '@/features/cart/actions'
import { CartSkeleton } from '@/features/cart/components/cart-skeleton'
import { UserCart } from '@/features/cart/components/user-cart'
import { getCartViewLabels } from '@/features/cart/labels'
import { getCart, getCartQuote } from '@/features/cart/queries'
import { localeAlternates } from '@/i18n/alternates'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('cart'), getLocale()])
  return {
    title: t('title'),
    description: t('metaDescription'),
    robots: { index: false, follow: true },
    alternates: localeAlternates('/cart', locale),
  }
}

/** Không cần đăng nhập. Static shell = tiêu đề; phần đọc phiên / giỏ trong Suspense. */
export default async function CartPage() {
  const t = await getTranslations('cart')
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="font-serif text-3xl font-medium md:text-4xl">{t('title')}</h1>
      <Suspense fallback={<CartSkeleton />}>
        <CartContent />
      </Suspense>
    </div>
  )
}

async function CartContent() {
  const [user, locale, labels, t] = await Promise.all([
    getCurrentUser(),
    getLocale(),
    getCartViewLabels(),
    getTranslations('cart'),
  ])

  const empty = (
    <div className="mt-8">
      <EmptyState
        icon={ShoppingBagIcon}
        title={t('emptyTitle')}
        description={t('emptyDescription')}
        action={
          <Link href="/" className={buttonVariants({ size: 'lg', className: 'h-10 px-4' })}>
            {t('browse')}
          </Link>
        }
      />
    </div>
  )

  if (!user) return empty

  const [lines, quote] = await Promise.all([getCart(), getCartQuote()])
  return (
    <UserCart
      lines={lines}
      quote={quote}
      labels={labels}
      locale={locale}
      setQuantity={setCartQuantity.bind(null, locale)}
      remove={removeFromCart.bind(null, locale)}
      empty={empty}
    />
  )
}
