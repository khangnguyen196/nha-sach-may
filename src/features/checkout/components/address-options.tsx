import { MapPinIcon, PlusIcon } from 'lucide-react'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { localizeDivisionNames } from '@/features/account/divisions'
import type { Address } from '@/features/account/queries'
import { getPathname, Link, type Href } from '@/i18n/navigation'

type Props = {
  addresses: Address[]
  /** Địa chỉ chọn sẵn (pickAddressId): ?address= vừa thêm từ trang thêm địa chỉ, hoặc địa chỉ mặc định */
  selectedId: number | undefined
  locale: Locale
  /**
   * Link "Thêm địa chỉ". Mặc định: về lại /thanh-toan sau khi lưu (?next=). Trang mua sách cũ truyền trang thêm địa chỉ
   * kèm ?next= về chính trang mua (parseAddressNext chỉ nhận hai loại URL này): lưu xong quay lại trang mua và địa chỉ
   * mới được chọn sẵn (?address=).
   */
  addHref?: Href
}

/** Nhóm radio gốc: chọn được bằng bàn phím (mũi tên), không cần JS */
export async function AddressOptions({ addresses, selectedId, locale, addHref: customAddHref }: Props) {
  const [t, tAddress] = await Promise.all([getTranslations('checkout'), getTranslations('address')])
  const addHref: Href = customAddHref ?? {
    pathname: '/account/addresses/new',
    query: { next: getPathname({ href: '/checkout', locale }) },
  }

  return (
    <fieldset id="checkout-address" className="scroll-mt-24">
      <legend className="text-lg font-semibold">{t('addressHeading')}</legend>

      {addresses.length === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-4 rounded-lg border border-dashed p-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPinIcon aria-hidden className="size-4 shrink-0" />
            {t('noAddress')}
          </p>
          <Link href={addHref} className={buttonVariants({ size: 'lg', className: 'h-10 px-4' })}>
            <PlusIcon aria-hidden />
            {t('addAddress')}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3">
            {addresses.map((address) => {
              const { province, ward } = localizeDivisionNames(address, locale)
              return (
                <label
                  key={address.id}
                  className="flex cursor-pointer gap-3 rounded-lg border bg-surface p-4 transition-colors duration-150 ease-out hover:bg-surface-raised has-checked:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                  data-testid="checkout-address-option"
                >
                  <input
                    type="radio"
                    name="address_id"
                    value={address.id}
                    defaultChecked={address.id === selectedId}
                    required
                    className="mt-1 size-4 shrink-0 accent-primary outline-none"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {address.recipient_name}
                      {address.is_default && (
                        <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                          {tAddress('default')}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{address.phone}</span>
                    <span className="mt-1 block text-sm">{[address.street, ward, province].join(', ')}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <Link
            href={addHref}
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mt-3 h-9 px-3 text-primary' })}
          >
            <PlusIcon aria-hidden />
            {t('addAddress')}
          </Link>
        </>
      )}
    </fieldset>
  )
}
