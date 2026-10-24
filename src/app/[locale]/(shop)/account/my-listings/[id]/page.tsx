import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { buttonVariants } from '@/components/ui/button'
import { accountPageMetadata } from '@/features/account/metadata'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import { deleteListingPhoto, quoteListing, updateListing, uploadListingPhoto } from '@/features/used/actions'
import { UsedDemoNote } from '@/features/used/components/demo-note'
import { ListingForm } from '@/features/used/components/listing-form'
import { ListingFormSkeleton } from '@/features/used/components/listing-form-skeleton'
import { getListingFormProps } from '@/features/used/form-props'
import { getMyListing } from '@/features/used/queries'
import { listingIdSchema } from '@/features/used/schemas'
import { getPathname, Link } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'

type Props = PageProps<'/[locale]/account/my-listings/[id]'>

// id không biết trước lúc build (không có generateStaticParams) nên header (LocaleSwitcher đọc useParams) không
// prerender được shell cho route này. Trang riêng tư, render theo request là đủ (như trang sửa địa chỉ).
export const instant = false

export async function generateMetadata({ params }: Props) {
  const [{ id }, t] = await Promise.all([params, getTranslations('used.form')])
  return accountPageMetadata(t('editTitle'), { pathname: '/account/my-listings/[id]', params: { id } })
}

export default async function EditListingPage({ params }: Props) {
  const [t, tList, tAccount, locale] = await Promise.all([
    getTranslations('used.form'),
    getTranslations('used.myListings'),
    getTranslations('account'),
    getLocale(),
  ])

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 md:py-12">
      <Breadcrumb
        items={[
          { label: tAccount('title'), href: '/account' },
          { label: tList('title'), href: '/account/my-listings' },
          { label: t('editTitle') },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-medium">{t('editTitle')}</h1>
      <div className="mt-6">
        <UsedDemoNote />
      </div>
      <div className="mt-8">
        <Suspense fallback={<ListingFormSkeleton />}>
          <EditListingForm locale={locale} params={params} />
        </Suspense>
      </div>
    </div>
  )
}

async function EditListingForm({ locale, params }: { locale: Locale; params: Props['params'] }) {
  const { id: rawId } = await params
  const id = listingIdSchema.safeParse(rawId)
  // Proxy đã trả 404 thật cho id sai / không có / của người khác; tới được đây là proxy không hỏi được DB → UI 404 trong
  // boundary (notFound() sau khi stream làm React bỏ SSR: lỗi #419)
  if (!id.success) return <InlineNotFound kind="used-listing" />

  const href = { pathname: '/account/my-listings/[id]', params: { id: String(id.data) } } as const
  const user = await requireUser(locale, href)
  const [props, listing, t] = await Promise.all([
    getListingFormProps(locale, getPathname({ href, locale })),
    getMyListing(id.data, user.id),
    getTranslations('used.form'),
  ])
  if (!listing) return <InlineNotFound kind="used-listing" />

  // Đã bán / đã rút (RPC cũng chặn: LISTING_NOT_EDITABLE); sách ngừng bán: lưu sẽ bị từ chối (BOOK_UNAVAILABLE)
  if (listing.status === 'sold' || listing.status === 'withdrawn' || !listing.book) {
    return (
      <div className="grid gap-6" data-testid="listing-not-editable">
        <p className="text-muted-foreground">{listing.book ? t('notEditable') : t('bookUnavailable')}</p>
        <Link href="/account/my-listings" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-11 w-fit px-5' })}>
          {t('backToList')}
        </Link>
      </div>
    )
  }

  const notice =
    listing.status === 'approved'
      ? t('approvedNote')
      : listing.status === 'rejected'
        ? t('rejectedNote', { reason: listing.rejectReason ?? '' })
        : null

  return (
    <div className="grid gap-6">
      {notice && (
        <p className="rounded-md border bg-surface px-3 py-2.5 text-sm" data-testid="listing-edit-notice">
          {notice}
        </p>
      )}
      <ListingForm
        {...props}
        action={updateListing.bind(null, locale, listing.id)}
        uploadPhoto={uploadListingPhoto.bind(null, locale)}
        deletePhoto={deleteListingPhoto.bind(null, locale)}
        quote={quoteListing.bind(null, locale)}
        initial={{
          book: { ...listing.book, id: listing.bookId, author: null },
          condition: listing.condition,
          price: String(listing.price),
          description: listing.description ?? '',
          photos: listing.photos,
          quote: { fee: listing.fee, payout: listing.price - listing.fee },
        }}
      />
    </div>
  )
}
