import { z } from 'zod'

/**
 * id khoản trả người bán do page bind vào markPayoutPaid (đi qua client nên parse lại): số nguyên dương an toàn, không
 * nhận chuỗi (page luôn bind số)
 */
export const payoutIdSchema = z.int().positive()
