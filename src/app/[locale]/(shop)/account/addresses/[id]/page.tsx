import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { updateAddress } from '@/features/account/actions'
import { AddressForm } from '@/features/account/components/address-form'
import { AddressFormSkeleton } from '@/features/account/components/address-form-skeleton'
import { findDivisionCodes, getWardOptions } from '@/features/account/divisions'
import { getAddressFormProps } from '@/features/account/form-props'
import { getAddress } from '@/features/account/queries'
import { addressIdSchema } from '@/features/account/schemas'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import { getPathname } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'

type Props = PageProps<'/[locale]/account/addresses/[id]'>

// id không biết trước lúc build (không có generateStaticParams) nên header (LocaleSwitcher đọc useParams) không
// prerender được shell cho route này. Trang riêng tư, render theo request là đủ → cho phép route chặn.
export const instant = false

export async function generateMetadata() {
  const t = await getTranslations('address')
  // Trang riêng tư (noindex) → không cần hreflang theo từng id
  return { title: t('editTitle'), robots: { index: false, follow: false } }
}

export default async function EditAddressPage({ params }: Props) {
  const [t, tAccount, locale] = await Promise.all([getTranslations('address'), getTranslations('account'), getLocale()])

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 md:py-12">
      <Breadcrumb
        items={[
          { label: tAccount('title'), href: '/account' },
          { label: t('title'), href: '/account/addresses' },
          { label: t('editTitle') },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-medium">{t('editTitle')}</h1>
      <div className="mt-8">
        <Suspense fallback={<AddressFormSkeleton />}>
          <EditAddressForm locale={locale} params={params} />
        </Suspense>
      </div>
    </div>
  )
}

async function EditAddressForm({ locale, params }: { locale: Locale; params: Props['params'] }) {
  const { id: rawId } = await params
  const id = addressIdSchema.safeParse(rawId)
  // Proxy đã trả 404 thật cho id sai / không có / của người khác; tới được đây là proxy không hỏi được DB → UI 404 trong
  // boundary (notFound() sau khi stream làm React bỏ SSR: lỗi #419)
  if (!id.success) return <InlineNotFound kind="address" />

  const href = { pathname: '/account/addresses/[id]', params: { id: String(id.data) } } as const
  await requireUser(locale, href)
  const [props, address] = await Promise.all([
    getAddressFormProps(locale, getPathname({ href, locale })),
    getAddress(id.data),
  ])
  // Không có hoặc của người khác (RLS lọc) → 404 như nhau, không lộ id nào tồn tại
  if (!address) return <InlineNotFound kind="address" />

  // Tên đã lưu → mã để chọn sẵn; dữ liệu hành chính đổi khiến không tìm thấy thì người dùng chọn lại
  const { provinceCode, wardCode } = findDivisionCodes(address.province, address.ward)

  return (
    <AddressForm
      {...props}
      action={updateAddress.bind(null, locale, id.data)}
      initial={{
        recipientName: address.recipient_name,
        phone: address.phone,
        street: address.street,
        provinceCode: provinceCode ?? '',
        wardCode: wardCode ?? '',
        wards: (provinceCode && getWardOptions(provinceCode, locale)) || [],
      }}
    />
  )
}
