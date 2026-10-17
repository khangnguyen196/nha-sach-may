import { CircleCheckIcon } from 'lucide-react'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { OrderDetails, OrderDetailsSkeleton } from '@/features/orders/components/order-details'
import { getOrderByCode } from '@/features/orders/queries'
import { awaitingTransfer } from '@/features/orders/utils'
import { VietQrCard } from '@/features/payments/components/vietqr-card'
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
      <Suspense fallback={<SuccessSkeleton />}>
        <OrderSuccess locale={locale} params={params} />
      </Suspense>
    </div>
  )
}

async function OrderSuccess({ locale, params }: { locale: Locale; params: Props['params'] }) {
  const { code } = await params
  const user = await requireUser(locale, { pathname: '/checkout/success/[code]', params: { code } })
  const [order, t, format] = await Promise.all([getOrderByCode(code, user.id), getTranslations('order'), getFormatter()])
  // Không có hoặc của người khác (lọc theo user_id) → 404 như nhau
  if (!order) notFound()

  return (
    <>
      <div className="mt-10" data-testid="order-success">
        <OrderDetails
          order={order}
          locale={locale}
          highlight={
            order.payment_method === 'bank_transfer' ? (
              <>
                <p className="-mt-2 text-center font-medium text-primary" data-testid="order-bank-amount">
                  {t('bankAmount', { total: format.number(order.total, 'price') })}
                </p>
                {awaitingTransfer(order) && <VietQrCard orderCode={order.order_code} amount={order.total} />}
              </>
            ) : (
              <p className="-mt-2 text-center font-medium text-primary" data-testid="order-cod">
                {t('codAmount', { total: format.number(order.total, 'price') })}
              </p>
            )
          }
        />
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href={{ pathname: '/account/orders/[code]', params: { code: order.order_code } }}
          className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-11 px-6 text-base' })}
        >
          {t('viewOrder')}
        </Link>
        <Link href="/" className={buttonVariants({ size: 'lg', className: 'h-11 px-6 text-base' })}>
          {t('continueShopping')}
        </Link>
      </div>
    </>
  )
}

function SuccessSkeleton() {
  return (
    <>
      <div className="mt-10">
        <OrderDetailsSkeleton />
      </div>
      <div aria-hidden className="mt-10 h-11" />
    </>
  )
}
