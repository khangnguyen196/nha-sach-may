import { z } from 'zod'
import { REASON_MAX } from '@/features/orders/schemas'
import { Constants } from '@/types/database'

/** Trạng thái đơn đang hiển thị khi admin bấm nút (page bind sẵn, đi qua client nên parse lại) */
export const orderStatusSchema = z.enum(Constants.public.Enums.order_status)

/**
 * Admin hủy đơn bắt buộc có lý do (khách đọc được ở trang chi tiết đơn). CRLF của textarea → LF trước khi đếm, cùng
 * giới hạn với ràng buộc orders_cancelled_reason_length.
 */
export const adminCancelOrderSchema = z.object({
  reason: z
    .string({ error: 'cancelReason' })
    .transform((value) => value.replace(/\r\n?/g, '\n').trim())
    .pipe(z.string().min(1, { error: 'cancelReason' }).max(REASON_MAX, { error: 'cancelReason' })),
})
