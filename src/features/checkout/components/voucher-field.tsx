import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { VoucherState } from '../queries'

/** id của form GET riêng (VoucherForm), ô nhập nằm trong form đặt hàng nên gắn bằng thuộc tính `form` */
export const VOUCHER_FORM_ID = 'checkout-voucher'

type Props = { voucher: VoucherState | null; addressId: number | undefined }

/**
 * Ô mã giảm giá trong cột tóm tắt. Áp dụng = GET `/thanh-toan?voucher=…` (mã nằm trên URL, server tính lại bằng
 * quote_order), chạy không cần JS. Form lồng nhau không hợp lệ nên ô và nút thuộc form riêng qua `form="…"`.
 */
export async function VoucherField({ voucher, addressId }: Props) {
  const t = await getTranslations('checkout')
  const applied = voucher && !voucher.failure ? voucher.code : null
  const error = voucher?.failure?.message

  return (
    <div className="mt-4 border-t pt-4" data-testid="checkout-voucher">
      {applied ? (
        <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="text-success">{t('voucherApplied', { code: applied })}</span>
          <Link
            href={{ pathname: '/checkout', query: addressId ? { address: String(addressId) } : {} }}
            className="rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t('voucherRemove')}
          </Link>
        </p>
      ) : (
        <>
          <label htmlFor="voucher" className="text-sm font-medium">
            {t('voucherLabel')}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="voucher"
              name="voucher"
              form={VOUCHER_FORM_ID}
              defaultValue={voucher?.code}
              maxLength={30}
              autoComplete="off"
              autoCapitalize="characters"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'voucher-error' : undefined}
              className="h-9 min-w-0 flex-1 rounded-sm border border-input bg-surface-raised px-3 text-sm uppercase outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            />
            <Button type="submit" form={VOUCHER_FORM_ID} variant="outline" className="h-9">
              {t('voucherApply')}
            </Button>
          </div>
          {error && (
            <p id="voucher-error" className="mt-1.5 text-sm text-sale" data-testid="voucher-error">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  )
}
