import { BanknoteIcon, QrCodeIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

const OPTION_CLASS =
  'flex cursor-pointer gap-3 rounded-lg border bg-surface p-4 transition-colors duration-150 ease-out hover:bg-surface-raised has-checked:border-primary has-focus-visible:ring-3 has-focus-visible:ring-focus-ring'

/** Nhóm radio gốc (không JS): COD mặc định, chuyển khoản VietQR (QR hiện ở trang đặt hàng thành công) */
export async function PaymentMethod() {
  const t = await getTranslations('checkout')
  const options = [
    { value: 'cod', icon: BanknoteIcon, label: t('cod'), hint: t('codHint') },
    { value: 'bank_transfer', icon: QrCodeIcon, label: t('bankTransfer'), hint: t('bankTransferHint') },
  ]
  return (
    <fieldset>
      <legend className="text-lg font-semibold">{t('paymentHeading')}</legend>
      <div className="mt-4 grid gap-3">
        {options.map(({ value, icon: Icon, label, hint }) => (
          <label key={value} className={OPTION_CLASS}>
            <input
              type="radio"
              name="payment_method"
              value={value}
              defaultChecked={value === 'cod'}
              className="mt-1 size-4 shrink-0 accent-primary outline-none"
            />
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <span className="block font-medium">{label}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
