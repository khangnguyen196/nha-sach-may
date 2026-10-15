import { BookIcon, CircleCheckIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import type { Locale } from 'next-intl'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { localizeDivisionNames } from '@/features/account/divisions'
import { getOrderByCode } from '@/features/orders/queries'
import { Link } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'

type Props = PageProps<'/[locale]/checkout/success/[code]'>

// Mã đơn không biết trước lúc build (không có generateStaticParams) nên header (LocaleSwitcher đọc useParams) không
// prerender được shell cho route này. Trang riêng tư, render theo request là đủ → cho phép route chặn.
export const instant = false

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('order')
  // Trang riêng tư (noindex) → không cần hreflang theo từng mã đơn
  return { title: t('successTitle'), robots: { index: false, follow: false } }
}

export default async function OrderSuccessPage({ params }: Props) {
  const [t, locale] = await Promise.all([getTranslations('order'), getLocale()])
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 md:py-16">
      <div className="flex flex-col items-center text-center">
        <CircleCheckIcon aria-hidden className="size-12 text-success" />
        <h1 className="mt-4 font-serif text-3xl font-medium md:text-4xl">{t('successTitle')}</h1>
        <p className="mt-2 text-muted-foreground">{t('successLead')}</p>
      </div>
      <Suspense fallback={<OrderSkeleton />}>
        <OrderDetails locale={locale} params={params} />
      </Suspense>
      <div className="mt-10 flex justify-center">
        <Link href="/" className={buttonVariants({ size: 'lg', className: 'h-11 px-6 text-base' })}>
          {t('continueShopping')}
        </Link>
      </div>
    </div>
  )
}

async function OrderDetails({ locale, params }: { locale: Locale; params: Props['params'] }) {
  const { code } = await params
  await requireUser(locale, { pathname: '/checkout/success/[code]', params: { code } })
  const [order, t, tCart, format] = await Promise.all([
    getOrderByCode(code),
    getTranslations('order'),
    getTranslations('cart'),
    getFormatter(),
  ])
  // Không có hoặc của người khác (RLS lọc) → 404 như nhau
  if (!order) notFound()

  const price = (value: number) => format.number(value, 'price')
  const { province, ward } = localizeDivisionNames(order, locale)

  return (
    <div className="mt-10 grid gap-6" data-testid="order-success">
      <dl className="grid gap-4 rounded-lg border bg-surface p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">{t('code')}</dt>
          <dd className="mt-1 font-mono text-2xl font-semibold tracking-wide select-all" data-testid="order-code">
            {order.order_code}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('placedAt')}</dt>
          <dd className="mt-1">{format.dateTime(new Date(order.created_at), 'short')}</dd>
        </div>
      </dl>
      <p className="-mt-2 text-center font-medium text-primary" data-testid="order-cod">
        {t('codAmount', { total: price(order.total) })}
      </p>

      <section aria-labelledby="order-ship-to" className="rounded-lg border bg-surface p-5">
        <h2 id="order-ship-to" className="text-sm text-muted-foreground">
          {t('shippingTo')}
        </h2>
        <p className="mt-2 font-medium">{order.recipient_name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{order.phone}</p>
        <p className="mt-1 text-sm">{[order.street, ward, province].join(', ')}</p>
        {order.note && (
          <p className="mt-3 border-t pt-3 text-sm whitespace-pre-line" data-testid="order-note">
            <span className="text-muted-foreground">{t('note')}: </span>
            {order.note}
          </p>
        )}
      </section>

      <section aria-labelledby="order-items" className="rounded-lg border bg-surface p-5">
        <h2 id="order-items" className="text-sm text-muted-foreground">
          {t('items')}
        </h2>
        <ul className="mt-3 divide-y border-y">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex gap-3 py-3" data-testid="order-item">
              {/* Tên sách hiển thị ngay bên cạnh → alt="" (ngoại lệ alt trong CLAUDE.md) */}
              <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-cover bg-surface-raised">
                {item.cover_url ? (
                  <Image src={item.cover_url} alt="" fill sizes="40px" className="object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-subtle">
                    <BookIcon aria-hidden className="size-4" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="line-clamp-2 font-medium">{item.title}</p>
                <p className="mt-0.5 text-muted-foreground">{t('quantity', { quantity: item.quantity })}</p>
              </div>
              <p className="shrink-0 text-sm tabular-nums">
                <span className="sr-only">{tCart('lineTotal')}: </span>
                {price(item.line_total ?? item.unit_price * item.quantity)}
              </p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">{tCart('subtotal')}</dt>
            <dd className="tabular-nums">{price(order.subtotal)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">{tCart('shipping')}</dt>
            <dd className="tabular-nums">
              {order.shipping_fee === 0 ? tCart('freeShipping') : price(order.shipping_fee)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t pt-3 text-base">
            <dt className="font-semibold">{tCart('total')}</dt>
            <dd className="font-semibold text-primary tabular-nums" data-testid="order-total">
              {price(order.total)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

function OrderSkeleton() {
  return (
    <div aria-hidden className="mt-10 grid animate-pulse gap-6 motion-reduce:animate-none">
      <div className="h-[98px] rounded-lg bg-surface-raised" />
      <div className="h-6 rounded-sm bg-surface-raised" />
      <div className="h-[130px] rounded-lg bg-surface-raised" />
      <div className="h-64 rounded-lg bg-surface-raised" />
    </div>
  )
}
