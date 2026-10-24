import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AdminBackLink, AdminPage } from '@/components/admin/admin-page'
import { FormSkeleton } from '@/components/admin/form-skeleton'
import { getAdminFormMessages } from '@/features/admin/form-messages'
import { advanceOrder, cancelOrderAsAdmin, markOrderPaid } from '@/features/admin/orders/actions'
import { AdvanceOrderForm } from '@/features/admin/orders/components/advance-order-form'
import { getAdminOrder } from '@/features/admin/orders/queries'
import { canAdminCancel, canMarkPaid, forwardStatus } from '@/features/admin/orders/status'
import { CancelOrderForm } from '@/features/orders/components/cancel-order-form'
import { OrderDetails } from '@/features/orders/components/order-details'
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge'
import { REASON_MAX } from '@/features/orders/schemas'
import { placeholder } from '@/lib/template'

type Props = PageProps<'/admin/don-hang/[code]'>

export async function generateMetadata() {
  const t = await getTranslations('admin.orders')
  return { title: t('detailTitle') }
}

export default async function AdminOrderPage({ params }: Props) {
  const t = await getTranslations('admin.orders')
  return (
    <AdminPage title={t('detailTitle')} before={<AdminBackLink href="/admin/don-hang" label={t('title')} />}>
      <Suspense fallback={<FormSkeleton sections={2} />}>
        <Order params={params} />
      </Suspense>
    </AdminPage>
  )
}

const panel = 'grid gap-4 rounded-lg border bg-surface p-5'

async function Order({ params }: { params: Props['params'] }) {
  const { code } = await params
  const [order, t, tOrder, tPayment, format, messages] = await Promise.all([
    getAdminOrder(code),
    getTranslations('admin.orders'),
    getTranslations('order'),
    getTranslations('order.paymentStatus'),
    getFormatter(),
    getAdminFormMessages(['ORDER_STATUS_CHANGED', 'ORDER_INVALID_TRANSITION', 'ORDER_REOPEN_FORBIDDEN']),
  ])
  if (!order) notFound()

  const forward = forwardStatus(order.status)
  const customerName = order.profiles ? order.profiles.full_name?.trim() || t('customer.noName') : null

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:items-start">
      <div className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-2xl font-semibold tracking-wide select-all">{order.order_code}</h2>
          <OrderStatusBadge status={order.status} />
        </div>
        {order.status === 'cancelled' && order.cancelled_reason && (
          <p className="text-sm whitespace-pre-line" data-testid="order-cancelled-reason">
            <span className="text-muted-foreground">{t('cancelledReason')}: </span>
            {order.cancelled_reason}
          </p>
        )}
        <OrderDetails order={order} locale="vi" showSeller />
      </div>

      <aside className="grid gap-6">
        <section aria-labelledby="order-process-title" className={panel}>
          <h2 id="order-process-title" className="text-sm font-semibold">
            {t('process.title')}
          </h2>
          <p className="text-sm text-muted-foreground" data-testid="order-process-hint">
            {t(`process.hint.${order.status}`)}
          </p>
          <AdvanceOrderForm
            action={advanceOrder.bind(null, order.id, order.status)}
            messages={messages}
            label={forward ? t(`process.forward.${forward}`) : null}
            pendingLabel={t('process.pending')}
            doneLabel={t('process.done')}
          />
          <CancelOrderForm
            action={cancelOrderAsAdmin.bind(null, order.id, order.status)}
            messages={messages}
            cancellable={canAdminCancel(order.status)}
            reasonMax={REASON_MAX}
            labels={{
              cancel: t('cancel.open'),
              cancelHint: t('cancel.hint'),
              reasonLabel: t('cancel.reason'),
              reasonHint: t('cancel.reasonHint'),
              reasonCount: t('cancel.reasonCount', { count: placeholder('count'), max: REASON_MAX }),
              confirmCancel: t('cancel.confirm'),
              cancelling: t('cancel.pending'),
              cancelDone: t('cancel.done'),
            }}
          />
        </section>

        <section aria-labelledby="order-payment-title" className={panel}>
          <h2 id="order-payment-title" className="text-sm font-semibold">
            {tOrder('payment')}
          </h2>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('payment.method')}</dt>
              <dd className="mt-0.5">{order.payment_method === 'cod' ? tOrder('cod') : t('payment.bankTransfer')}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('payment.status')}</dt>
              <dd
                className={order.payment_status === 'paid' ? 'mt-0.5 text-success' : 'mt-0.5'}
                data-testid="order-payment-status"
              >
                {tPayment(order.payment_status)}
              </dd>
            </div>
            {order.voucher_code && (
              <div>
                <dt className="text-muted-foreground">{t('payment.voucher')}</dt>
                <dd className="mt-0.5 font-mono">
                  {order.voucher_code} (−{format.number(order.discount, 'price')})
                </dd>
              </div>
            )}
          </dl>
          {canMarkPaid(order) && <p className="text-sm text-muted-foreground">{t('payment.markPaidHint')}</p>}
          {/* Luôn render (label null khi không còn bấm được) để thông báo kết quả còn sau refresh() */}
          <AdvanceOrderForm
            action={markOrderPaid.bind(null, order.id)}
            messages={messages}
            label={canMarkPaid(order) ? t('payment.markPaid') : null}
            pendingLabel={t('payment.markPaidPending')}
            doneLabel={t('payment.markPaidDone')}
          />
          {order.payment_status === 'paid' && canAdminCancel(order.status) && (
            <p className="text-sm text-muted-foreground" data-testid="order-refund-note">
              {t('payment.refundNote')}
            </p>
          )}
        </section>

        <section aria-labelledby="order-customer-title" className={panel}>
          <h2 id="order-customer-title" className="text-sm font-semibold">
            {t('customer.title')}
          </h2>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('customer.account')}</dt>
              <dd className="mt-0.5">{customerName ?? t('customer.deleted')}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('updatedAt')}</dt>
              <dd className="mt-0.5 tabular-nums">
                {format.dateTime(new Date(order.updated_at), { dateStyle: 'short', timeStyle: 'short' })}
              </dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  )
}
