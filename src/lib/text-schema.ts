import { z } from 'zod'
import type { ValidationKey } from './errors'

/**
 * Ô văn bản nhiều dòng không bắt buộc (ghi chú đơn, lý do hủy). Chỉ import ở server (schemas.ts).
 * Trình duyệt gửi xuống dòng của textarea dạng CRLF, còn maxLength / bộ đếm ở client tính LF → chuẩn hóa trước khi
 * đếm để chuỗi vừa đủ `max` ký tự không bị báo quá dài. Rỗng sau khi trim → null.
 */
export function optionalMultilineText(max: number, key: ValidationKey) {
  return z
    .string()
    .optional()
    .transform((value) => (value ?? '').replace(/\r\n?/g, '\n').trim())
    .pipe(z.string().max(max, { error: key }))
    .transform((value) => value || null)
}
