import { MapPinIcon, PlusIcon } from 'lucide-react'
import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { AddressCard } from '@/features/account/components/address-card'
import { accountPageMetadata } from '@/features/account/metadata'
import { getAddresses } from '@/features/account/queries'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import { EmptyState } from '@/features/books/components/empty-state'
import { Link } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'

export async function generateMetadata() {
  const t = await getTranslations('address')
  return accountPageMetadata(t('title'), '/account/addresses')
}

export default async function AddressesPage() {
  const [t, tAccount, locale] = await Promise.all([getTranslations('address'), getTranslations('account'), getLocale()])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">
      <Breadcrumb items={[{ label: tAccount('title'), href: '/account' }, { label: t('title') }]} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-3xl font-medium md:text-4xl">{t('title')}</h1>
        <Link href="/account/addresses/new" className={buttonVariants({ size: 'lg', className: 'h-10 px-4' })}>
          <PlusIcon aria-hidden />
          {t('add')}
        </Link>
      </div>
      <Suspense fallback={<AddressListSkeleton />}>
        <AddressList locale={locale} />
      </Suspense>
    </div>
  )
}

async function AddressList({ locale }: { locale: Locale }) {
  await requireUser(locale, '/account/addresses')
  const [t, addresses] = await Promise.all([getTranslations('address'), getAddresses()])

  if (addresses.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={MapPinIcon}
          title={t('emptyTitle')}
          description={t('empty')}
          action={
            <Link href="/account/addresses/new" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-10 px-4' })}>
              {t('add')}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <ul className="mt-8 grid gap-4">
      {addresses.map((address) => (
        <AddressCard key={address.id} address={address} locale={locale} />
      ))}
    </ul>
  )
}

function AddressListSkeleton() {
  return (
    <div aria-hidden className="mt-8 grid animate-pulse gap-4">
      <div className="h-[150px] rounded-lg bg-surface-raised" />
      <div className="h-[150px] rounded-lg bg-surface-raised" />
    </div>
  )
}
