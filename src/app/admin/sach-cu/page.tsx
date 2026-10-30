import { ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminLink } from '@/components/admin/admin-link'
import { AdminPage } from '@/components/admin/admin-page'
import { AdminPagination } from '@/components/admin/admin-pagination'
import { TableSkeleton } from '@/components/admin/table-skeleton'
import { buttonVariants } from '@/components/ui/button'
import { ADMIN_PAGE_SIZE } from '@/features/admin/params'
import { usedListingListHref, usedListingListParamsSchema } from '@/features/admin/used/params'
import { listAdminUsedListings } from '@/features/admin/used/queries'
import { ListingStatusBadge } from '@/features/used/components/listing-status-badge'
import { LISTING_STATUSES } from '@/features/used/status'
import { cn } from '@/lib/utils'

export async function generateMetadata() {
  const t = await getTranslations('admin.usedListings')
  return { title: t('title') }
}

/** Duyệt tin sách cũ: mặc định tin chờ duyệt (cũ nhất trước), lọc theo trạng thái qua URL */
export default async function AdminUsedListingsPage({ searchParams }: PageProps<'/admin/sach-cu'>) {
  const t = await getTranslations('admin.usedListings')
  return (
    <AdminPage title={t('title')}>
      <Suspense fallback={<TableSkeleton withFilters />}>
        <UsedListingList searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  )
}

const cell = 'px-3 py-3 align-middle'
const headCell = 'px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'

async function UsedListingList({ searchParams }: { searchParams: PageProps<'/admin/sach-cu'>['searchParams'] }) {
  const params = usedListingListParamsSchema.parse(await searchParams)
  const [t, tStatus, tCondition, format, { listings, total }] = await Promise.all([
    getTranslations('admin.usedListings'),
    getTranslations('used.status'),
    getTranslations('used.condition'),
    getFormatter(),
    listAdminUsedListings(params),
  ])
  const chip = (active: boolean) =>
    buttonVariants({ variant: active ? 'secondary' : 'ghost', size: 'sm', className: cn(active && 'font-semibold') })

  return (
    <div className="grid gap-6">
      <nav aria-label={t('filterLabel')} className="flex flex-wrap gap-2">
        {LISTING_STATUSES.map((status) => (
          <AdminLink
            key={status}
            href={usedListingListHref(params, { status, page: undefined })}
            aria-current={params.status === status ? 'true' : undefined}
            className={chip(params.status === status)}
          >
            {tStatus(status)}
          </AdminLink>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground" role="status">
        {t('count', { count: total })}
      </p>
      {listings.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">
          {params.status === 'pending' ? t('emptyPending') : t('empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-3xl text-sm" data-testid="admin-used-listings">
            <caption className="sr-only">{t('table.caption')}</caption>
            <thead className="border-b bg-surface">
              <tr>
                <th scope="col" className={headCell}>
                  <span className="sr-only">{t('table.photo')}</span>
                </th>
                <th scope="col" className={headCell}>
                  {t('table.book')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.condition')}
                </th>
                <th scope="col" className={cn(headCell, 'text-right')}>
                  {t('table.price')}
                </th>
                <th scope="col" className={cn(headCell, 'text-right')}>
                  {t('table.fee')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.seller')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.createdAt')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {listings.map((listing) => (
                <tr key={listing.id} className="hover:bg-surface" data-testid="admin-used-listing" data-listing-id={listing.id}>
                  <td className={cn(cell, 'w-14')}>
                    <div className="relative aspect-[3/4] w-10 overflow-hidden rounded-cover bg-surface-raised">
                      {listing.photoUrl ? (
                        // Ảnh tin, alt="" vì tên sách ngay bên cạnh. Link ký theo request, ảnh đã nén WebP lúc tải lên →
                        // không qua bộ tối ưu ảnh
                        <Image src={listing.photoUrl} alt="" fill unoptimized className="object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-subtle">
                          <ImageIcon aria-hidden className="size-4" />
                          <span className="sr-only">{t('noPhoto')}</span>
                        </span>
                      )}
                    </div>
                  </td>
                  <th scope="row" className={cn(cell, 'text-left font-normal')}>
                    <AdminLink
                      href={`/admin/sach-cu/${listing.id}`}
                      className="line-clamp-2 rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-focus-ring"
                    >
                      {listing.book?.title ?? t('bookDeleted')}
                    </AdminLink>
                    {listing.book && <span className="block text-xs text-muted-foreground">{listing.book.slug}</span>}
                  </th>
                  <td className={cn(cell, 'whitespace-nowrap')}>{tCondition(listing.condition)}</td>
                  <td className={cn(cell, 'text-right tabular-nums')}>{format.number(listing.price, 'price')}</td>
                  <td className={cn(cell, 'text-right text-muted-foreground tabular-nums')}>
                    {format.number(listing.fee, 'price')}
                  </td>
                  <td className={cell}>{listing.sellerName ?? t('member')}</td>
                  <td className={cn(cell, 'whitespace-nowrap text-muted-foreground tabular-nums')}>
                    {format.dateTime(new Date(listing.createdAt), { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className={cell}>
                    <ListingStatusBadge status={listing.status} />
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
        hrefFor={(target) => usedListingListHref(params, { page: target })}
      />
    </div>
  )
}
