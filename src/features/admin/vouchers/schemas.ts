import { z } from 'zod'
import { VOUCHER_CODE } from '@/features/checkout/voucher'
import { Constants } from '@/types/database'
import { checkbox, integer, optionalInteger, optionalText } from '../schemas'
import { vnInputToIso } from './datetime'

const MONEY_MAX = 100_000_000

/** Ô `datetime-local` (giờ VN) không bắt buộc: rỗng → null, có giá trị → ISO UTC */
const optionalDateTime = z
  .string({ error: 'dateTime' })
  .optional()
  .transform((value, ctx) => {
    const trimmed = value?.trim() ?? ''
    if (!trimmed) return null
    const iso = vnInputToIso(trimmed)
    if (iso) return iso
    ctx.addIssue({ code: 'custom', message: 'dateTime' })
    return z.NEVER
  })

export const voucherFormSchema = z
  .object({
    code: z
      .string({ error: 'voucherCode' })
      .transform((value) => value.trim().toUpperCase())
      .pipe(z.string().regex(VOUCHER_CODE, { error: 'voucherCode' })),
    description: optionalText(300, 'voucherDescription'),
    description_en: optionalText(300, 'voucherDescription'),
    discount_type: z.enum(Constants.public.Enums.discount_type, { error: 'discountType' }),
    discount_value: integer('discountValue', 1, MONEY_MAX),
    max_discount: optionalInteger('positiveInt', 1, MONEY_MAX),
    min_order_value: optionalInteger('minOrder', 0, MONEY_MAX),
    usage_limit: optionalInteger('positiveInt', 1, 1_000_000),
    starts_at: optionalDateTime,
    ends_at: optionalDateTime,
    is_active: checkbox,
    is_public: checkbox,
  })
  // Ràng buộc giữa các ô (cùng check của bảng vouchers): % ≤ 100; trần giảm chỉ có nghĩa với loại %
  .transform((data, ctx) => {
    if (data.discount_type === 'percent' && data.discount_value > 100) {
      ctx.addIssue({ code: 'custom', path: ['discount_value'], message: 'discountPercent' })
    }
    if (data.starts_at && data.ends_at && data.ends_at <= data.starts_at) {
      ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'endsAfterStarts' })
    }
    return {
      ...data,
      max_discount: data.discount_type === 'percent' ? data.max_discount : null,
      min_order_value: data.min_order_value ?? 0,
    }
  })

export type VoucherFormInput = z.output<typeof voucherFormSchema>
