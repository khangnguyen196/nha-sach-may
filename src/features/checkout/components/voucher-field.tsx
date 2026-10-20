import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { localize } from '@/lib/i18n-db'
import type { VoucherState } from '../queries'
import { voucherCard, type RankedVoucher } from '../voucher-suggestions'
import { VoucherPicker } from './voucher-picker'

/** id của form GET riêng (VoucherForm), ô nhập nằm trong form đặt hàng nên gắn bằng thuộc tính `form` */
export const VOUCHER_FORM_ID = 'checkout-voucher'

const INPUT_ID = 'voucher'

type Props = {
  voucher: VoucherState | null
  addressId: number | undefined
  /** Mã gợi ý (rankVouchers): rỗng → không có nút "Chọn mã giảm giá" */
  suggestions: RankedVoucher[]
}

/**
 * Ô mã giảm giá trong cột tóm tắt. Áp dụng = GET `/thanh-toan?voucher=…` (mã nằm trên URL, server tính lại bằng
 * quote_order), gửi không cần JS (nhưng tắt JS thì nội dung trang thanh toán nằm trong stream, không hiện:
 * docs/plans/no-js.md). Form lồng nhau không hợp lệ nên ô và nút thuộc form riêng qua `form="…"`.
 */
export async function VoucherField({ voucher, addressId, suggestions }: Props) {
  const [t, format, locale] = await Promise.all([getTranslations('checkout'), getFormatter(), getLocale()])
  const applied = voucher && !voucher.failure ? voucher.code : null
  const error = voucher?.failure?.message
  const cards = suggestions.map((suggestion) =>
    voucherCard(suggestion, {
      t: (key, values) => t(key, values),
      price: (value) => format.number(value, 'price'),
      date: (iso) => format.dateTime(new Date(iso), 'short'),
      note: (row) => localize(row, 'description', locale) || null,
    }),
  )

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
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <label htmlFor={INPUT_ID} className="text-sm font-medium">
              {t('voucherLabel')}
            </label>
            {cards.length > 0 && (
              <VoucherPicker
                vouchers={cards}
                formId={VOUCHER_FORM_ID}
                inputId={INPUT_ID}
                labels={{
                  pick: t('voucherPick'),
                  title: t('voucherListTitle'),
                  use: t('voucherUse'),
                  close: t('voucherClose'),
                }}
              />
            )}
          </div>
          <div className="mt-1.5 flex gap-2">
            <input
              id={INPUT_ID}
              name="voucher"
              form={VOUCHER_FORM_ID}
              defaultValue={voucher?.code}
              maxLength={30}
              autoComplete="off"
              autoCapitalize="characters"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'voucher-error' : undefined}
              className="h-9 min-w-0 flex-1 rounded-sm border border-input bg-surface-raised px-3 text-base uppercase sm:text-sm outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
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
