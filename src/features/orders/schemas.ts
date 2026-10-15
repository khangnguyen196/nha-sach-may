import { z } from 'zod'
import { optionalMultilineText } from '@/lib/text-schema'

// Chỉ import ở server (zod không vào bundle client).

/** Cùng giới hạn với ràng buộc orders_cancelled_reason_length trong schema.sql */
export const REASON_MAX = 500

/** id đơn do page bind sẵn vào action (đi qua client nên parse lại) */
export const orderIdSchema = z.number().int().positive()

export const cancelOrderSchema = z.object({ reason: optionalMultilineText(REASON_MAX, 'reason') })
