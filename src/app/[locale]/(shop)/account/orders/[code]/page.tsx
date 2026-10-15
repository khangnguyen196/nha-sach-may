import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import { cancelOrder } from '@/features/orders/actions'
import { CancelOrderForm } from '@/features/orders/components/cancel-order-form'
import { OrderDetails, OrderDetailsSkeleton } from '@/features/orders/components/order-details'
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge'
import { getOrderByCode } from '@/features/orders/queries'
import { REASON_MAX } from '@/features/orders/schemas'
import { awaitingTransfer, canCancel } from '@/features/orders/utils'
import { VietQrCard } from '@/features/payments/components/vietqr-card'
import { requireUser } from '@/lib/auth'
import { getFormMessages } from '@/lib/form-messages'
import { placeholder } from '@/lib/template'

type Props = PageProps<'/[locale]/account/orders/[code]'>

// Mã đơn không biết trước lúc build → không prerender được shell (như trang đặt hàng thành công)
export const instant = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ code }, t] = await Promise.all([params, getTranslations('orders')])
  // Tiêu đề lấy từ URL, không query đơn; trang riêng tư (noindex) → không cần hreflang theo từng mã đơn
  return { title: t('detailTitle', { code }), robots: { index: false, follow: false } }
}

export default async function OrderPage({ params }: Props) {
  const [t, tAccount, locale] = await Promise.all([getTranslations('orders'), getTranslations('account'), getLocale()])
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">
      <Breadcrumb items={[{ label: tAccount('title'), href: '/account' }, { label: t('title'), href: '/account/orders' }]} />
      <Suspense fallback={<OrderSkeleton />}>
        <Order locale={locale} params={params} />
      </Suspense>
    </div>
  )
}

async function Order({ locale, params }: { locale: Locale; params: Props['params'] }) {
  const { code } = await params
  await requireUser(locale, { pathname: '/account/orders/[code]', params: { code } })
  const [order, t, tOrder, messages] = await Promise.all([
    getOrderByCode(code),
    getTranslations('orders'),
    getTranslations('order'),
    getFormMessages(['ORDER_NOT_CANCELLABLE', 'AUTH_REQUIRED']),
  ])
  // Không có hoặc của người khác (RLS lọc) → 404 như nhau
  if (!order) notFound()

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-medium md:text-4xl">{t('detailTitle', { code: order.order_code })}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-2 text-muted-foreground" data-testid="order-explain">
        {t(`explain.${order.status}`)}
      </p>
      {order.status === 'cancelled' && order.cancelled_reason && (
        <p className="mt-2 text-sm whitespace-pre-line" data-testid="order-cancelled-reason">
          <span className="text-muted-foreground">{t('cancelledReason')}: </span>
          {order.cancelled_reason}
        </p>
      )}

      <div className="mt-8">
        <OrderDetails
          order={order}
          locale={locale}
          highlight={
            <p className="-mt-2 text-sm text-muted-foreground">
              {tOrder('payment')}:{' '}
              <span className="text-foreground" data-testid="order-payment-method">
                {order.payment_method === 'bank_transfer' ? tOrder('bankTransfer') : tOrder('cod')}
              </span>
              {' · '}
              <span
                className={order.payment_status === 'paid' ? 'text-success' : 'text-foreground'}
                data-testid="order-payment-status"
              >
                {tOrder(`paymentStatus.${order.payment_status}`)}
              </span>
            </p>
          }
        />
      </div>

      {awaitingTransfer(order) && (
        <div className="mt-6">
          <VietQrCard orderCode={order.order_code} amount={order.total} />
        </div>
      )}

      <CancelOrderForm
        action={cancelOrder.bind(null, locale, order.id, order.order_code)}
        messages={messages}
        cancellable={canCancel(order)}
        reasonMax={REASON_MAX}
        labels={{
          cancel: t('cancel'),
          cancelHint: t('cancelHint'),
          reasonLabel: t('reasonLabel'),
          reasonHint: t('reasonHint'),
          reasonCount: t('reasonCount', { count: placeholder('count'), max: REASON_MAX }),
          confirmCancel: t('confirmCancel'),
          cancelling: t('cancelling'),
          cancelDone: t('cancelDone'),
        }}
      />
    </>
  )
}

function OrderSkeleton() {
  return (
    <>
      <div aria-hidden className="mt-6 animate-pulse motion-reduce:animate-none">
        <div className="h-10 w-72 max-w-full rounded-sm bg-surface-raised md:h-14" />
        <div className="mt-2 h-6 w-64 max-w-full rounded-sm bg-surface-raised" />
      </div>
      <div className="mt-8">
        <OrderDetailsSkeleton />
      </div>
    </>
  )
}
