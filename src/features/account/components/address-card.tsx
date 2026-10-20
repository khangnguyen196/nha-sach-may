import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { deleteAddress, setDefaultAddress } from '../actions'
import { localizeDivisionNames } from '../divisions'
import type { Address } from '../queries'

/**
 * Một địa chỉ trong sổ. Mọi nút là form + Server Action trả `void` + `refresh()` (không qua useFormAction) → nút khóa tới
 * khi hydrate (`lockUntilHydrated`): gửi trước đó là POST thường, ra trang trắng (docs/plans/no-js.md, ★8).
 */
export async function AddressCard({ address, locale }: { address: Address; locale: Locale }) {
  const [t, tAuth] = await Promise.all([getTranslations('address'), getTranslations('auth')])
  const { province, ward } = localizeDivisionNames(address, locale)
  const name = address.recipient_name
  const small = buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-8 px-3' })

  return (
    <li className="rounded-lg border bg-surface p-5">
      <p className="flex flex-wrap items-center gap-2 font-medium">
        {name}
        {address.is_default && (
          <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">{t('default')}</span>
        )}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{address.phone}</p>
      <p className="mt-2 text-sm">{[address.street, ward, province].join(', ')}</p>

      <div className="mt-4 flex flex-wrap items-start gap-1">
        <Link
          href={{ pathname: '/account/addresses/[id]', params: { id: String(address.id) } }}
          aria-label={t('editLabel', { name })}
          className={small}
        >
          {t('edit')}
        </Link>
        {!address.is_default && (
          <form action={setDefaultAddress.bind(null, address.id)}>
            <SubmitButton lockUntilHydrated variant="ghost" size="sm" className="h-8 px-3" pendingLabel={tAuth('pending')}>
              {t('setDefault')}
            </SubmitButton>
          </form>
        )}
        {/* Xác nhận xóa bằng <details>: mở / đóng không cần JS, bàn phím dùng được, không thêm dialog vào bundle */}
        <details className="group">
          <summary
            aria-label={t('deleteLabel', { name })}
            className={cn(small, 'cursor-pointer list-none text-destructive [&::-webkit-details-marker]:hidden')}
          >
            {t('delete')}
          </summary>
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
            <span className="text-sm">{t('confirmDelete')}</span>
            <form action={deleteAddress.bind(null, address.id)}>
              <SubmitButton
                lockUntilHydrated
                variant="destructive"
                size="sm"
                className="h-8 px-3"
                pendingLabel={tAuth('pending')}
              >
                {t('confirmDeleteAction')}
              </SubmitButton>
            </form>
          </div>
        </details>
      </div>
    </li>
  )
}
