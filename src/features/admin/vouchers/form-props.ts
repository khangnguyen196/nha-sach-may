import 'server-only'
import { getTranslations } from 'next-intl/server'
import { getAdminFormMessages } from '../form-messages'
import type { VoucherFormLabels, VoucherFormValues } from './components/voucher-form'
import { isoToVnInput } from './datetime'
import type { AdminVoucher } from './queries'

/** Chuỗi + mã lỗi cho form voucher; `mode` đổi nhãn nút (tạo / lưu) */
export async function getVoucherFormProps(mode: 'create' | 'edit') {
  const [t, tVouchers, tCommon, messages] = await Promise.all([
    getTranslations('admin.vouchers.fields'),
    getTranslations('admin.vouchers'),
    getTranslations('admin.common'),
    getAdminFormMessages(['VOUCHER_CODE_TAKEN']),
  ])
  const labels: VoucherFormLabels = {
    code: t('code'),
    codeHint: t('codeHint'),
    description: t('description'),
    descriptionEn: t('descriptionEn'),
    descriptionEnHint: t('descriptionEnHint'),
    discountType: t('discountType'),
    types: { percent: tVouchers('types.percent'), fixed: tVouchers('types.fixed') },
    discountValue: t('discountValue'),
    discountValueHint: t('discountValueHint'),
    maxDiscount: t('maxDiscount'),
    maxDiscountHint: t('maxDiscountHint'),
    minOrder: t('minOrder'),
    minOrderHint: t('minOrderHint'),
    usageLimit: t('usageLimit'),
    usageLimitHint: t('usageLimitHint'),
    startsAt: t('startsAt'),
    endsAt: t('endsAt'),
    periodHint: t('periodHint'),
    active: t('active'),
    activeHint: t('activeHint'),
    submit: mode === 'edit' ? tCommon('save') : tCommon('create'),
    pending: mode === 'edit' ? tCommon('saving') : tCommon('creating'),
    saved: tCommon('saved'),
    cancel: tCommon('cancel'),
  }
  return { messages, labels }
}

export const EMPTY_VOUCHER: VoucherFormValues = {
  code: '',
  description: '',
  description_en: '',
  discount_type: 'percent',
  discount_value: '',
  max_discount: '',
  min_order_value: '',
  usage_limit: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
}

const text = (value: number | string | null) => (value === null ? '' : String(value))

export function voucherFormValues(voucher: AdminVoucher): VoucherFormValues {
  return {
    code: voucher.code,
    description: text(voucher.description),
    description_en: text(voucher.description_en),
    discount_type: voucher.discount_type,
    discount_value: text(voucher.discount_value),
    max_discount: text(voucher.max_discount),
    min_order_value: voucher.min_order_value === 0 ? '' : text(voucher.min_order_value),
    usage_limit: text(voucher.usage_limit),
    starts_at: isoToVnInput(voucher.starts_at),
    ends_at: isoToVnInput(voucher.ends_at),
    is_active: voucher.is_active,
  }
}
