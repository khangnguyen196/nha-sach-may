import { getFormatter, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminLink } from '@/components/admin/admin-link'
import { AdminPage } from '@/components/admin/admin-page'
import { AdminPagination } from '@/components/admin/admin-pagination'
import { TableSkeleton } from '@/components/admin/table-skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { SelectField, TextField } from '@/components/ui/field'
import { orderListHref, orderListParamsSchema, type OrderListParams } from '@/features/admin/orders/params'
import { listAdminOrders } from '@/features/admin/orders/queries'
import { ADMIN_PAGE_SIZE } from '@/features/admin/params'
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge'
import { Constants } from '@/types/database'
import { cn } from '@/lib/utils'

export async function generateMetadata() {
  const t = await getTranslations('admin.orders')
  return { title: t('title') }
}

export default async function AdminOrdersPage({ searchParams }: PageProps<'/admin/don-hang'>) {
  const t = await getTranslations('admin.orders')
  return (
    <AdminPage title={t('title')}>
      <Suspense fallback={<TableSkeleton withFilters />}>
        <OrderList searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  )
}

const cell = 'px-3 py-3 align-middle'
const headCell = 'px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'

async function OrderList({ searchParams }: { searchParams: PageProps<'/admin/don-hang'>['searchParams'] }) {
  const params = orderListParamsSchema.parse(await searchParams)
  const [t, tPayment, format, { orders, total }] = await Promise.all([
    getTranslations('admin.orders'),
    getTranslations('order.paymentStatus'),
    getFormatter(),
    listAdminOrders(params),
  ])
  const filtered = Boolean(params.q || params.status)

  return (
    <div className="grid gap-6">
      <OrderFilters params={params} />
      <p className="text-sm text-muted-foreground" role="status">
        {t('count', { count: total })}
      </p>
      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">
          {filtered ? t('emptyFiltered') : t('empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-3xl text-sm">
            <caption className="sr-only">{t('table.caption')}</caption>
            <thead className="border-b bg-surface">
              <tr>
                <th scope="col" className={headCell}>
                  {t('table.code')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.date')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.recipient')}
                </th>
                <th scope="col" className={cn(headCell, 'text-right')}>
                  {t('table.total')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.status')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.payment')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-surface">
                  <th scope="row" className={cn(cell, 'text-left font-normal')}>
                    <AdminLink
                      href={`/admin/don-hang/${order.order_code}`}
                      className="rounded-sm font-mono font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {order.order_code}
                    </AdminLink>
                  </th>
                  <td className={cn(cell, 'whitespace-nowrap text-muted-foreground tabular-nums')}>
                    {format.dateTime(new Date(order.created_at), { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className={cell}>
                    <span className="block">{order.recipient_name}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{order.phone}</span>
                  </td>
                  <td className={cn(cell, 'text-right tabular-nums')}>{format.number(order.total, 'price')}</td>
                  <td className={cell}>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className={cn(cell, order.payment_status === 'paid' ? 'text-success' : 'text-muted-foreground')}>
                    {tPayment(order.payment_status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AdminPagination
        page={params.page ?? 1}
        totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)}
        hrefFor={(target) => orderListHref(params, { page: target })}
      />
    </div>
  )
}

/** Form GET: chạy không cần JS, bộ lọc nằm trên URL. Gửi lại không kèm `page` → về trang 1. */
async function OrderFilters({ params }: { params: OrderListParams }) {
  const [t, tStatus, tCommon] = await Promise.all([
    getTranslations('admin.orders.filters'),
    getTranslations('order.status'),
    getTranslations('admin.common'),
  ])
  return (
    <form
      method="get"
      action="/admin/don-hang"
      role="search"
      aria-label={t('label')}
      className="grid gap-4 rounded-lg border bg-surface p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end"
    >
      <TextField
        name="q"
        type="search"
        label={t('q')}
        placeholder={t('qHint')}
        defaultValue={params.q ?? ''}
        maxLength={100}
        idPrefix="filter"
      />
      <SelectField name="status" label={t('status')} defaultValue={params.status ?? ''} idPrefix="filter">
        <option value="">{t('allStatuses')}</option>
        {Constants.public.Enums.order_status.map((status) => (
          <option key={status} value={status}>
            {tStatus(status)}
          </option>
        ))}
      </SelectField>
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-11 px-5">
          {tCommon('filter')}
        </Button>
        {(params.q || params.status) && (
          <AdminLink href="/admin/don-hang" className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'h-11 px-4' })}>
            {tCommon('clearFilters')}
          </AdminLink>
        )}
      </div>
    </form>
  )
}
