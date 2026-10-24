import { ImageOffIcon } from 'lucide-react'
import Image from 'next/image'
import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AdminBackLink, AdminPage } from '@/components/admin/admin-page'
import { FormSkeleton } from '@/components/admin/form-skeleton'
import { ShopLink } from '@/components/admin/shop-link'
import { getAdminFormMessages } from '@/features/admin/form-messages'
import { rowIdSchema } from '@/features/admin/schemas'
import { approveListing, rejectListing } from '@/features/admin/used/actions'
import { ListingReviewPanel } from '@/features/admin/used/components/listing-review-panel'
import { getAdminUsedListing } from '@/features/admin/used/queries'
import { REJECT_REASON_MAX } from '@/features/admin/used/schemas'
import { ListingStatusBadge } from '@/features/used/components/listing-status-badge'
import { placeholder } from '@/lib/template'

type Props = PageProps<'/admin/sach-cu/[id]'>

export async function generateMetadata() {
  const t = await getTranslations('admin.usedListings')
  return { title: t('detailTitle') }
}

export default async function AdminUsedListingPage({ params }: Props) {
  const t = await getTranslations('admin.usedListings')
  return (
    <AdminPage title={t('detailTitle')} before={<AdminBackLink href="/admin/sach-cu" label={t('title')} />}>
      <Suspense fallback={<FormSkeleton sections={2} />}>
        <UsedListing params={params} />
      </Suspense>
    </AdminPage>
  )
}

const panel = 'grid gap-4 rounded-lg border bg-surface p-5'

async function UsedListing({ params }: { params: Props['params'] }) {
  const { id: rawId } = await params
  const id = rowIdSchema.safeParse(rawId)
  if (!id.success) notFound()

  const [listing, t, tCondition, tCommon, format, messages] = await Promise.all([
    getAdminUsedListing(id.data),
    getTranslations('admin.usedListings'),
    getTranslations('used.condition'),
    getTranslations('admin.common'),
    getFormatter(),
    getAdminFormMessages([
      'LISTING_STATUS_CHANGED',
      'LISTING_PHOTOS_MISSING',
      'LISTING_INVALID_TRANSITION',
      'LISTING_PRICE_INVALID',
    ]),
  ])
  if (!listing) notFound()

  const price = (value: number) => format.number(value, 'price')
  const dateTime = (value: string) => format.dateTime(new Date(value), { dateStyle: 'short', timeStyle: 'short' })
  const pending = listing.status === 'pending'
  const overMax = listing.book !== null && listing.price > listing.book.maxPrice

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:items-start">
      <div className="grid min-w-0 gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-serif text-2xl font-medium" data-testid="used-listing-title">
            {listing.book?.title ?? t('bookDeleted')}
          </h2>
          <ListingStatusBadge status={listing.status} />
        </div>

        <section aria-labelledby="used-listing-photos-title" className="grid gap-3">
          <h3 id="used-listing-photos-title" className="text-sm font-semibold">
            {t('photos')}
          </h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="used-listing-photos">
            {listing.photos.map((photo, index) => (
              <li key={photo.path} className="relative aspect-[3/4] overflow-hidden rounded-cover border bg-surface-raised">
                {photo.url ? (
                  // Ảnh đứng một mình (không kèm tên sách) → alt có số thứ tự. Link ký theo request, ảnh đã nén WebP lúc
                  // tải lên → không qua bộ tối ưu ảnh
                  <Image
                    src={photo.url}
                    alt={t('photoAlt', { number: index + 1 })}
                    fill
                    unoptimized
                    sizes="(min-width: 640px) 33vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <span
                    className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-sm text-muted-foreground"
                    data-testid="used-listing-photo-missing"
                  >
                    <ImageOffIcon aria-hidden className="size-5" />
                    {t('photoMissing')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="used-listing-info-title" className={panel}>
          <h3 id="used-listing-info-title" className="text-sm font-semibold">
            {t('info')}
          </h3>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t('book')}</dt>
              <dd className="mt-0.5">
                {listing.book ? (
                  <ShopLink
                    pathname="/books/[slug]"
                    slug={listing.book.slug}
                    label={listing.book.title}
                    newTabLabel={tCommon('opensInNewTab')}
                    hiddenLabel={listing.book.isActive ? undefined : tCommon('hiddenInShop')}
                  />
                ) : (
                  t('bookDeleted')
                )}
                {listing.book && !listing.book.isActive && pending && (
                  <span className="mt-1 block text-destructive">{t('bookInactive')}</span>
                )}
              </dd>
            </div>
            {listing.book && (
              <div>
                <dt className="text-muted-foreground">{t('maxPrice')}</dt>
                <dd className="mt-0.5 tabular-nums" data-testid="used-listing-max-price">
                  {price(listing.book.maxPrice)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">{t('price')}</dt>
              <dd className="mt-0.5 font-semibold text-primary tabular-nums" data-testid="used-listing-price">
                {price(listing.price)}
              </dd>
              {overMax && pending && <dd className="mt-1 text-destructive">{t('overMax')}</dd>}
            </div>
            <div>
              <dt className="text-muted-foreground">{t('fee')}</dt>
              <dd className="mt-0.5 tabular-nums">{price(listing.fee)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('payout')}</dt>
              <dd className="mt-0.5 tabular-nums">{price(listing.price - listing.fee)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('condition')}</dt>
              <dd className="mt-0.5">{tCondition(listing.condition)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('seller')}</dt>
              <dd className="mt-0.5">{listing.sellerName ?? t('member')}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t('description')}</dt>
              <dd className="mt-0.5 max-w-reading whitespace-pre-line">
                {listing.description ?? <span className="text-subtle">{t('noDescription')}</span>}
              </dd>
            </div>
            {listing.rejectReason && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{t('rejectReason')}</dt>
                <dd className="mt-0.5 whitespace-pre-line" data-testid="used-listing-reject-reason">
                  {listing.rejectReason}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">{t('createdAt')}</dt>
              <dd className="mt-0.5 tabular-nums">{dateTime(listing.createdAt)}</dd>
            </div>
            {listing.approvedAt && (
              <div>
                <dt className="text-muted-foreground">{t('approvedAt')}</dt>
                <dd className="mt-0.5 tabular-nums">{dateTime(listing.approvedAt)}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">{t('updatedAt')}</dt>
              <dd className="mt-0.5 tabular-nums">{dateTime(listing.updatedAt)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <aside>
        <section aria-labelledby="used-listing-review-title" className={panel}>
          <h2 id="used-listing-review-title" className="text-sm font-semibold">
            {t('review')}
          </h2>
          <ListingReviewPanel
            status={listing.status}
            approveAction={approveListing.bind(null, listing.id)}
            rejectAction={rejectListing.bind(null, listing.id)}
            messages={messages}
            reasonMax={REJECT_REASON_MAX}
            labels={{
              approve: t('approve'),
              approving: t('approving'),
              approved: t('approved'),
              reasonLabel: t('reasonLabel'),
              reasonHint: t('reasonHint'),
              reasonCount: t('reasonCount', { count: placeholder('count'), max: REJECT_REASON_MAX }),
              reject: t('reject'),
              rejecting: t('rejecting'),
              rejected: t('rejected'),
              takedown: t('takedown'),
              takedownHint: t('takedownHint'),
              takedownQuestion: t('takedownQuestion'),
              takedownConfirm: t('takedownConfirm'),
              takedownCancel: t('takedownCancel'),
              takingDown: t('takingDown'),
              takenDown: t('takenDown'),
              readOnly: {
                rejected: t('readOnly.rejected'),
                sold: t('readOnly.sold'),
                withdrawn: t('readOnly.withdrawn'),
              },
            }}
          />
        </section>
      </aside>
    </div>
  )
}
