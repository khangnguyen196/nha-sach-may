import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { accountPageMetadata } from '@/features/account/metadata'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import {
  createListing,
  deleteListingPhoto,
  quoteListing,
  searchBooksForListing,
  uploadListingPhoto,
} from '@/features/used/actions'
import { UsedDemoNote } from '@/features/used/components/demo-note'
import { ListingForm } from '@/features/used/components/listing-form'
import { ListingFormSkeleton } from '@/features/used/components/listing-form-skeleton'
import { PendingLimitNotice } from '@/features/used/components/pending-limit-notice'
import { getListingFormProps } from '@/features/used/form-props'
import { USED_PENDING_LIMIT } from '@/features/used/limits'
import { removeMyOrphanPhotos } from '@/features/used/photo-storage'
import { countMyPendingListings } from '@/features/used/queries'
import { getPathname } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'

export async function generateMetadata() {
  const t = await getTranslations('used.form')
  return accountPageMetadata(t('newTitle'), '/account/my-listings/new')
}

export default async function NewListingPage() {
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
          { label: t('newTitle') },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-medium">{t('newTitle')}</h1>
      <div className="mt-6">
        <UsedDemoNote />
      </div>
      <div className="mt-8">
        <Suspense fallback={<ListingFormSkeleton />}>
          <NewListingForm locale={locale} />
        </Suspense>
      </div>
    </div>
  )
}

async function NewListingForm({ locale }: { locale: Locale }) {
  const user = await requireUser(locale, '/account/my-listings/new')
  const [props, pendingCount] = await Promise.all([
    getListingFormProps(locale, getPathname({ href: '/account/my-listings/new', locale })),
    countMyPendingListings(user.id),
    // Ảnh tải lên rồi bỏ form (cũ hơn 24 giờ) không chiếm trần 30 ảnh mãi; lỗi bỏ qua
    removeMyOrphanPhotos(user.id),
  ])
  if (pendingCount >= USED_PENDING_LIMIT) return <PendingLimitNotice />

  return (
    <ListingForm
      {...props}
      action={createListing.bind(null, locale)}
      uploadPhoto={uploadListingPhoto.bind(null, locale)}
      deletePhoto={deleteListingPhoto.bind(null, locale)}
      quote={quoteListing.bind(null, locale)}
      searchBooks={searchBooksForListing.bind(null, locale)}
      initial={{ book: null, condition: null, price: '', description: '', photos: [], quote: null }}
    />
  )
}
