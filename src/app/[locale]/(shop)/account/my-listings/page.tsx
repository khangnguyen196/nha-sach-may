import { BookOpenIcon, ImageIcon } from 'lucide-react'
import Image from 'next/image'
import type { Locale } from 'next-intl'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { accountPageMetadata } from '@/features/account/metadata'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import { EmptyState } from '@/features/books/components/empty-state'
import { withdrawListing } from '@/features/used/actions'
import { ListingStatusBadge } from '@/features/used/components/listing-status-badge'
import { PendingLimitNotice } from '@/features/used/components/pending-limit-notice'
import { WithdrawButton } from '@/features/used/components/withdraw-button'
import { USED_PENDING_LIMIT } from '@/features/used/limits'
import { countMyPendingListings, listMyListings, type MyListing } from '@/features/used/queries'
import { Link } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'
import { getFormMessages } from '@/lib/form-messages'

export async function generateMetadata() {
  const t = await getTranslations('used.myListings')
  return accountPageMetadata(t('title'), '/account/my-listings')
}

export default async function MyListingsPage() {
  const [t, tAccount, locale] = await Promise.all([
    getTranslations('used.myListings'),
    getTranslations('account'),
    getLocale(),
  ])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:py-12">
      <Breadcrumb items={[{ label: tAccount('title'), href: '/account' }, { label: t('title') }]} />
      <h1 className="mt-6 font-serif text-3xl font-medium md:text-4xl">{t('title')}</h1>
      <p className="mt-2 max-w-reading text-muted-foreground">{t('lead')}</p>
      {/* Danh sách đọc phiên → stream sau; tiêu đề prerender sẵn */}
      <Suspense fallback={<MyListingsSkeleton />}>
        <MyListings locale={locale} />
      </Suspense>
    </div>
  )
}

/** Sửa / rút được khi tin chưa bán, chưa rút (update_used_listing / withdraw_used_listing) */
const ACTIVE_STATUSES = new Set(['pending', 'approved', 'rejected'])

async function MyListings({ locale }: { locale: Locale }) {
  const user = await requireUser(locale, '/account/my-listings')
  const [listings, pendingCount, t, messages] = await Promise.all([
    listMyListings(user.id),
    countMyPendingListings(user.id),
    getTranslations('used.myListings'),
    getFormMessages(['AUTH_REQUIRED', 'LISTING_NOT_EDITABLE']),
  ])
  const limitReached = pendingCount >= USED_PENDING_LIMIT

  const newListing = (
    <Link href="/account/my-listings/new" className={buttonVariants({ size: 'lg', className: 'h-11 px-5' })}>
      {t('newListing')}
    </Link>
  )

  return (
    <>
      <div className="mt-6">
        {limitReached ? (
          <PendingLimitNotice />
        ) : (
          listings.length > 0 && newListing
        )}
      </div>
      {listings.length === 0 ? (
        <div className="mt-2">
          <EmptyState
            icon={BookOpenIcon}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            action={newListing}
          />
        </div>
      ) : (
        <ul aria-label={t('listLabel')} className="mt-6 grid gap-3" data-testid="my-listings">
          {listings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} locale={locale} errors={messages.errors} />
          ))}
        </ul>
      )}
    </>
  )
}

type RowProps = {
  listing: MyListing
  locale: Locale
  errors: Awaited<ReturnType<typeof getFormMessages>>['errors']
}

/** Ảnh tin alt="" vì tên sách hiện ngay bên cạnh (ngoại lệ alt của CLAUDE.md) */
async function ListingRow({ listing, locale, errors }: RowProps) {
  const [t, tCondition, tWithdraw, format] = await Promise.all([
    getTranslations('used.myListings'),
    getTranslations('used.condition'),
    getTranslations('used.withdraw'),
    getFormatter(),
  ])
  const title = listing.book?.title ?? t('bookUnavailable')
  const active = ACTIVE_STATUSES.has(listing.status)
  const headingId = `listing-${listing.id}-heading`

  return (
    <li data-testid="listing-row" data-listing-id={listing.id}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-lg border bg-surface p-4 sm:p-5">
        <div className="relative aspect-[3/4] w-16 overflow-hidden rounded-cover bg-surface-raised sm:w-20">
          {listing.photoUrl ? (
            // Link ký theo request, ảnh đã nén WebP lúc tải lên → không qua bộ tối ưu ảnh
            <Image src={listing.photoUrl} alt="" fill unoptimized className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-subtle">
              <ImageIcon aria-hidden className="size-5" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          {/* Nhận focus sau khi rút tin (nút Rút tin bị gỡ khỏi trang): đọc tên sách + trạng thái mới */}
          <div
            id={headingId}
            tabIndex={-1}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            data-testid="listing-heading"
          >
            <p className="line-clamp-2 font-medium">{title}</p>
            <ListingStatusBadge status={listing.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {tCondition(listing.condition)} · {t('listedAt', { date: format.dateTime(new Date(listing.createdAt), 'short') })}
          </p>
          <p className="mt-1 text-sm">
            <span className="font-semibold text-primary tabular-nums" data-testid="listing-price">
              {format.number(listing.price, 'price')}
            </span>{' '}
            <span className="text-muted-foreground">
              {t('payout', { amount: format.number(listing.price - listing.fee, 'price') })}
            </span>
          </p>
          {listing.status === 'rejected' && listing.rejectReason && (
            <p className="mt-2 text-sm text-destructive" data-testid="listing-reject-reason">
              {t('rejectReason', { reason: listing.rejectReason })}
            </p>
          )}
          {active && (
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <Link
                href={{ pathname: '/account/my-listings/[id]', params: { id: String(listing.id) } }}
                aria-label={t('editLabel', { title })}
                className={buttonVariants({ variant: 'outline', size: 'sm', className: 'h-9 px-3' })}
              >
                {t('edit')}
              </Link>
              <WithdrawButton
                action={withdrawListing.bind(null, locale, listing.id)}
                errors={errors}
                focusAfterWithdrawId={headingId}
                labels={{
                  button: tWithdraw('button'),
                  question: tWithdraw('question'),
                  confirm: tWithdraw('confirm'),
                  cancel: tWithdraw('cancel'),
                  pending: tWithdraw('pending'),
                }}
              />
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

function MyListingsSkeleton() {
  return (
    <div aria-hidden className="animate-pulse motion-reduce:animate-none">
      <div className="mt-6 h-11 w-32 rounded-lg bg-surface-raised" />
      <div className="mt-6 grid gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-[170px] rounded-lg bg-surface-raised sm:h-[188px]" />
        ))}
      </div>
    </div>
  )
}
