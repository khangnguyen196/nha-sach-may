import { TriangleAlertIcon } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminLink } from '@/components/admin/admin-link'
import { AdminPage } from '@/components/admin/admin-page'
import { AdminPagination } from '@/components/admin/admin-pagination'
import { TableSkeleton } from '@/components/admin/table-skeleton'
import { buttonVariants } from '@/components/ui/button'
import { getAdminFormMessages } from '@/features/admin/form-messages'
import { ADMIN_PAGE_SIZE } from '@/features/admin/params'
import { markPayoutPaid } from '@/features/admin/payouts/actions'
import { MarkPayoutPaidForm } from '@/features/admin/payouts/components/mark-payout-paid-form'
import { payoutListHref, payoutListParamsSchema, type PayoutStatus } from '@/features/admin/payouts/params'
import { listAdminPayouts, type AdminPayout } from '@/features/admin/payouts/queries'
import type { FormMessages } from '@/lib/form-messages'
import { cn } from '@/lib/utils'

export async function generateMetadata() {
  const t = await getTranslations('admin.payouts')
  return { title: t('title') }
}

/**
 * Khoản trả người bán của Chợ sách cũ (sổ tiền MÔ PHỎNG): mọi khoản mới nhất trước, lọc chờ trả / đã trả qua URL,
 * "Đã trả" chỉ ghi trạng thái, không chuyển tiền thật.
 */
export default async function AdminPayoutsPage({ searchParams }: PageProps<'/admin/tra-nguoi-ban'>) {
  const t = await getTranslations('admin.payouts')
  return (
    <AdminPage title={t('title')}>
      <p
        className="mb-6 flex max-w-reading gap-2 rounded-md border border-sale/40 bg-sale/10 px-3 py-2.5 text-sm text-sale"
        data-testid="payouts-demo-note"
      >
        <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t('demoNote')}
      </p>
      <Suspense fallback={<TableSkeleton withFilters />}>
        <PayoutList searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  )
}

const cell = 'px-3 py-3 align-middle'
const headCell = 'px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'

/** Chip lọc: undefined = tất cả */
const FILTERS: readonly (PayoutStatus | undefined)[] = [undefined, 'pending', 'paid']

// Chờ trả: màu nhấn nhạt; đã trả: thành công (cùng tông với khối "Đã bán" của người bán)
const STATUS_TONE: Record<PayoutStatus, string> = {
  pending: 'bg-primary/15 text-primary',
  paid: 'bg-success/15 text-success',
}

const isPayoutStatus = (status: string): status is PayoutStatus => status === 'pending' || status === 'paid'

async function PayoutList({ searchParams }: { searchParams: PageProps<'/admin/tra-nguoi-ban'>['searchParams'] }) {
  const params = payoutListParamsSchema.parse(await searchParams)
  const [t, { payouts, total }, messages] = await Promise.all([
    getTranslations('admin.payouts'),
    listAdminPayouts(params),
    getAdminFormMessages(['PAYOUT_STATUS_CHANGED']),
  ])
  const chip = (active: boolean) =>
    buttonVariants({ variant: active ? 'secondary' : 'ghost', size: 'sm', className: cn(active && 'font-semibold') })
  const empty = params.status === 'pending' ? t('emptyPending') : params.status === 'paid' ? t('emptyPaid') : t('empty')

  return (
    <div className="grid gap-6">
      <nav aria-label={t('filterLabel')} className="flex flex-wrap gap-2">
        {FILTERS.map((status) => (
          <AdminLink
            key={status ?? 'all'}
            href={payoutListHref(params, { status, page: undefined })}
            aria-current={params.status === status ? 'true' : undefined}
            className={chip(params.status === status)}
          >
            {t(`filter.${status ?? 'all'}`)}
          </AdminLink>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground" role="status">
        {t('count', { count: total })}
      </p>
      {payouts.length === 0 ? (
        <p
          className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground"
          data-testid="admin-payouts-empty"
        >
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-5xl text-sm" data-testid="admin-payouts">
            <caption className="sr-only">{t('table.caption')}</caption>
            <thead className="border-b bg-surface">
              <tr>
                <th scope="col" className={headCell}>
                  {t('table.book')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.order')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.seller')}
                </th>
                <th scope="col" className={cn(headCell, 'text-right')}>
                  {t('table.price')}
                </th>
                <th scope="col" className={cn(headCell, 'text-right')}>
                  {t('table.fee')}
                </th>
                <th scope="col" className={cn(headCell, 'text-right')}>
                  {t('table.amount')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.orderStatus')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.createdAt')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.status')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.paidAt')}
                </th>
                <th scope="col" className={headCell}>
                  <span className="sr-only">{t('table.action')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payouts.map((payout) => (
                <PayoutRow key={payout.id} payout={payout} messages={messages} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AdminPagination
        page={params.page ?? 1}
        totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)}
        hrefFor={(target) => payoutListHref(params, { page: target })}
      />
    </div>
  )
}

async function PayoutRow({ payout, messages }: { payout: AdminPayout; messages: FormMessages }) {
  const [t, tOrder, tPayment, format] = await Promise.all([
    getTranslations('admin.payouts'),
    getTranslations('order.status'),
    getTranslations('order.paymentStatus'),
    getFormatter(),
  ])
  const price = (value: number) => format.number(value, 'price')
  const dateTime = (value: string) => format.dateTime(new Date(value), { dateStyle: 'short', timeStyle: 'short' })
  const status = isPayoutStatus(payout.status) ? payout.status : null

  return (
    <tr className="hover:bg-surface" data-testid="admin-payout" data-payout-id={payout.id}>
      <th scope="row" className={cn(cell, 'text-left font-medium')}>
        <span className="line-clamp-2">{payout.title}</span>
      </th>
      <td className={cn(cell, 'whitespace-nowrap')}>
        <AdminLink
          href={`/admin/don-hang/${payout.orderCode}`}
          className="rounded-sm font-mono outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-focus-ring"
        >
          {payout.orderCode}
        </AdminLink>
      </td>
      <td className={cell}>{payout.sellerName ?? t('member')}</td>
      <td className={cn(cell, 'text-right tabular-nums')}>{price(payout.price)}</td>
      <td className={cn(cell, 'text-right text-muted-foreground tabular-nums')}>{price(payout.fee)}</td>
      <td className={cn(cell, 'text-right font-semibold tabular-nums')} data-testid="admin-payout-amount">
        {price(payout.amount)}
      </td>
      <td className={cn(cell, 'whitespace-nowrap text-muted-foreground')} data-testid="admin-payout-order-status">
        {tOrder(payout.orderStatus)} · {tPayment(payout.paymentStatus)}
      </td>
      <td className={cn(cell, 'whitespace-nowrap text-muted-foreground tabular-nums')}>{dateTime(payout.createdAt)}</td>
      <td className={cell}>
        <span
          className={cn(
            'inline-flex rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap',
            status ? STATUS_TONE[status] : 'bg-surface-raised text-muted-foreground',
          )}
          data-testid="admin-payout-status"
          data-status={payout.status}
        >
          {status ? t(`status.${status}`) : payout.status}
        </span>
      </td>
      <td className={cn(cell, 'whitespace-nowrap text-muted-foreground tabular-nums')} data-testid="admin-payout-paid-at">
        {payout.paidAt && dateTime(payout.paidAt)}
      </td>
      <td className={cell}>
        <MarkPayoutPaidForm
          action={markPayoutPaid.bind(null, payout.id)}
          messages={messages}
          payable={payout.payable}
          labels={{
            button: t('markPaid'),
            buttonLabel: t('markPaidLabel', { title: payout.title }),
            pending: t('markPaidPending'),
            done: t('markPaidDone'),
          }}
        />
      </td>
    </tr>
  )
}
