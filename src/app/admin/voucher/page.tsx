import { PlusIcon } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminLink } from '@/components/admin/admin-link'
import { AdminPage } from '@/components/admin/admin-page'
import { AdminPagination } from '@/components/admin/admin-pagination'
import { TableSkeleton } from '@/components/admin/table-skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { ADMIN_PAGE_SIZE } from '@/features/admin/params'
import { voucherListHref, voucherListParamsSchema } from '@/features/admin/vouchers/params'
import { listAdminVouchers, type AdminVoucherRow } from '@/features/admin/vouchers/queries'
import { voucherState, type VoucherState } from '@/features/admin/vouchers/state'
import { cn } from '@/lib/utils'

export async function generateMetadata() {
  const t = await getTranslations('admin.vouchers')
  return { title: t('title') }
}

export default async function AdminVouchersPage({ searchParams }: PageProps<'/admin/voucher'>) {
  const t = await getTranslations('admin.vouchers')
  return (
    <AdminPage
      title={t('title')}
      actions={
        <AdminLink href="/admin/voucher/moi" className={buttonVariants({ size: 'lg', className: 'h-11 px-4' })}>
          <PlusIcon aria-hidden />
          {t('new')}
        </AdminLink>
      }
    >
      <Suspense fallback={<TableSkeleton withFilters />}>
        <VoucherList searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  )
}

const cell = 'px-3 py-3 align-middle'
const headCell = 'px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'

const STATE_TONE: Record<VoucherState, string> = {
  active: 'bg-success/15 text-success',
  scheduled: 'bg-primary/15 text-primary',
  inactive: 'bg-surface-raised text-muted-foreground',
  expired: 'bg-surface-raised text-muted-foreground',
  exhausted: 'bg-surface-raised text-muted-foreground',
}

async function VoucherList({ searchParams }: { searchParams: PageProps<'/admin/voucher'>['searchParams'] }) {
  const params = voucherListParamsSchema.parse(await searchParams)
  const [t, tCommon, format, { vouchers, total }] = await Promise.all([
    getTranslations('admin.vouchers'),
    getTranslations('admin.common'),
    getFormatter(),
    listAdminVouchers(params),
  ])
  const now = new Date()
  const price = (value: number) => format.number(value, 'price')
  const dateTime = (value: string) => format.dateTime(new Date(value), { dateStyle: 'short', timeStyle: 'short' })

  function discount(voucher: AdminVoucherRow) {
    if (voucher.discount_type === 'fixed') return price(voucher.discount_value)
    return voucher.max_discount === null
      ? t('discount.percent', { value: voucher.discount_value })
      : t('discount.percentCapped', { value: voucher.discount_value, max: price(voucher.max_discount) })
  }

  function period({ starts_at, ends_at }: AdminVoucherRow) {
    if (starts_at && ends_at) return t('period.range', { start: dateTime(starts_at), end: dateTime(ends_at) })
    if (starts_at) return t('period.from', { start: dateTime(starts_at) })
    if (ends_at) return t('period.until', { end: dateTime(ends_at) })
    return t('period.always')
  }

  return (
    <div className="grid gap-6">
      {/* Form GET: chạy không cần JS, từ khóa nằm trên URL */}
      <form
        method="get"
        action="/admin/voucher"
        role="search"
        aria-label={t('search')}
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-surface p-4"
      >
        <div className="min-w-60 flex-1">
          <TextField
            name="q"
            type="search"
            label={t('search')}
            defaultValue={params.q ?? ''}
            maxLength={100}
            idPrefix="filter"
          />
        </div>
        <Button type="submit" size="lg" className="h-11 px-5">
          {tCommon('filter')}
        </Button>
        {params.q && (
          <AdminLink href="/admin/voucher" className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'h-11 px-4' })}>
            {tCommon('clearFilters')}
          </AdminLink>
        )}
      </form>
      <p className="text-sm text-muted-foreground" role="status">
        {t('count', { count: total })}
      </p>
      {vouchers.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">
          {params.q ? t('emptyFiltered') : t('empty')}
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
                  {t('table.discount')}
                </th>
                <th scope="col" className={cn(headCell, 'text-right')}>
                  {t('table.minOrder')}
                </th>
                <th scope="col" className={cn(headCell, 'text-right')}>
                  {t('table.usage')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.period')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vouchers.map((voucher) => {
                const state = voucherState(voucher, now)
                return (
                  <tr key={voucher.id} className="hover:bg-surface">
                    <th scope="row" className={cn(cell, 'text-left font-normal')}>
                      <AdminLink
                        href={`/admin/voucher/${voucher.id}`}
                        className="rounded-sm font-mono font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {voucher.code}
                      </AdminLink>
                      {voucher.is_public && (
                        <span className="ml-2 inline-flex rounded-sm bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                          {t('publicBadge')}
                        </span>
                      )}
                      {voucher.description && (
                        <span className="block text-xs text-muted-foreground">{voucher.description}</span>
                      )}
                    </th>
                    <td className={cn(cell, 'tabular-nums')}>{discount(voucher)}</td>
                    <td className={cn(cell, 'text-right tabular-nums')}>{price(voucher.min_order_value)}</td>
                    <td className={cn(cell, 'text-right tabular-nums')}>
                      {voucher.usage_limit === null
                        ? t('usage.unlimited', { used: voucher.used_count })
                        : t('usage.limited', { used: voucher.used_count, limit: voucher.usage_limit })}
                    </td>
                    <td className={cn(cell, 'text-muted-foreground tabular-nums')}>{period(voucher)}</td>
                    <td className={cell}>
                      <span
                        className={cn('inline-flex rounded-sm px-2 py-0.5 text-xs font-medium', STATE_TONE[state])}
                        data-testid="voucher-state"
                      >
                        {t(`states.${state}`)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <AdminPagination
        page={params.page ?? 1}
        totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)}
        hrefFor={(target) => voucherListHref(params, { page: target })}
      />
    </div>
  )
}
