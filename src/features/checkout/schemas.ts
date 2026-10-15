import { z } from 'zod'
import type { ValidationKey } from '@/lib/errors'

// Chỉ import ở server (zod không vào bundle client). Form dùng thuộc tính HTML (required, maxLength) cho phản hồi
// nhanh; kiểm tra thật chạy ở Server Action với schema này, place_order kiểm tra thêm lần cuối.

const error = (key: ValidationKey) => ({ error: key })

/** Cùng giới hạn với ràng buộc orders_note_length trong schema.sql */
export const NOTE_MAX = 500

// Trình duyệt gửi xuống dòng của textarea dạng CRLF, còn maxLength / bộ đếm ở client tính LF
// → chuẩn hóa trước khi đếm để ghi chú vừa đủ 500 ký tự không bị báo quá dài
const note = z
  .string()
  .optional()
  .transform((value) => (value ?? '').replace(/\r\n?/g, '\n').trim())
  .pipe(z.string().max(NOTE_MAX, error('note')))
  .transform((value) => value || null)

export const checkoutSchema = z.object({
  address_id: z.coerce.number(error('address')).int(error('address')).positive(error('address')),
  note,
  idempotency_key: z.uuid(),
  /** Tổng tiền đang hiển thị: chỉ để place_order so sánh, không dùng để tính */
  expected_total: z.coerce.number().int().nonnegative(),
})

export type CheckoutInput = z.output<typeof checkoutSchema>
