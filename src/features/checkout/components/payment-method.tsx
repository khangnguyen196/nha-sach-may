import { BanknoteIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

/** Chỉ có COD (VietQR ở Phase 9). Không có ô nhập: server tự đặt `cod`, client không gửi phương thức. */
export async function PaymentMethod() {
  const t = await getTranslations('checkout')
  return (
    <section aria-labelledby="checkout-payment">
      <h2 id="checkout-payment" className="text-lg font-semibold">
        {t('paymentHeading')}
      </h2>
      <div className="mt-4 flex gap-3 rounded-lg border border-primary bg-surface p-4">
        <BanknoteIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium">{t('cod')}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('codHint')}</p>
        </div>
      </div>
    </section>
  )
}
