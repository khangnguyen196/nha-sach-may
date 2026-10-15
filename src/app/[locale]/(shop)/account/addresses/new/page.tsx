import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { createAddress } from '@/features/account/actions'
import { AddressForm } from '@/features/account/components/address-form'
import { AddressFormSkeleton } from '@/features/account/components/address-form-skeleton'
import { getAddressFormProps } from '@/features/account/form-props'
import { accountPageMetadata } from '@/features/account/metadata'
import { getProfile } from '@/features/account/queries'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import { getPathname } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'

type Props = PageProps<'/[locale]/account/addresses/new'>

export async function generateMetadata() {
  const t = await getTranslations('address')
  return accountPageMetadata(t('newTitle'), '/account/addresses/new')
}

export default async function NewAddressPage({ searchParams }: Props) {
  const [t, tAccount, locale] = await Promise.all([getTranslations('address'), getTranslations('account'), getLocale()])

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 md:py-12">
      <Breadcrumb
        items={[
          { label: tAccount('title'), href: '/account' },
          { label: t('title'), href: '/account/addresses' },
          { label: t('newTitle') },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-medium">{t('newTitle')}</h1>
      <div className="mt-8">
        <Suspense fallback={<AddressFormSkeleton />}>
          <NewAddressForm locale={locale} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}

async function NewAddressForm({ locale, searchParams }: { locale: Locale; searchParams: Props['searchParams'] }) {
  // ?next= chỉ nhận đúng URL trang thanh toán của locale này (link "Thêm địa chỉ" ở checkout); giá trị khác bỏ qua
  const { next } = await searchParams
  const fromCheckout = next === getPathname({ href: '/checkout', locale })
  const user = await requireUser(
    locale,
    fromCheckout ? { pathname: '/account/addresses/new', query: { next } } : '/account/addresses/new',
  )
  const [props, profile] = await Promise.all([getAddressFormProps(locale), getProfile(user.id)])

  return (
    <AddressForm
      {...props}
      action={createAddress.bind(null, locale, fromCheckout ? 'checkout' : null)}
      cancelHref={fromCheckout ? '/checkout' : '/account/addresses'}
      // Tên người nhận mặc định là tên chủ tài khoản (thường giao cho chính mình)
      initial={{
        recipientName: profile?.full_name ?? user.fullName ?? '',
        phone: '',
        street: '',
        provinceCode: '',
        wardCode: '',
        wards: [],
      }}
    />
  )
}
