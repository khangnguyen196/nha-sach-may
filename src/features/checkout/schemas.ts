import { z } from 'zod'
import type { ValidationKey } from '@/lib/errors'
import { optionalMultilineText } from '@/lib/text-schema'
import { normalizeVoucherCode } from './voucher'

// Chỉ import ở server (zod không vào bundle client). Form dùng thuộc tính HTML (required, maxLength) cho phản hồi
// nhanh; kiểm tra thật chạy ở Server Action với schema này, place_order kiểm tra thêm lần cuối.

const error = (key: ValidationKey) => ({ error: key })

/** Cùng giới hạn với ràng buộc orders_note_length trong schema.sql */
export const NOTE_MAX = 500

export const checkoutSchema = z.object({
  address_id: z.coerce.number(error('address')).int(error('address')).positive(error('address')),
  note: optionalMultilineText(NOTE_MAX, 'note'),
  idempotency_key: z.uuid(),
  /** Tổng tiền đang hiển thị: chỉ để place_order so sánh, không dùng để tính */
  expected_total: z.coerce.number().int().nonnegative(),
  payment_method: z.enum(['cod', 'bank_transfer']).default('cod'),
  /** Mã đã áp dụng ở trang (hidden): rỗng → không voucher; sai dạng → lỗi (form bị sửa tay) */
  voucher_code: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value?.trim()) return null
      const code = normalizeVoucherCode(value)
      if (code) return code
      ctx.addIssue({ code: 'custom', message: 'invalid' })
      return z.NEVER
    }),
})

export type CheckoutInput = z.output<typeof checkoutSchema>
