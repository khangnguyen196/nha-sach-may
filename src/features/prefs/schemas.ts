import { z } from 'zod'

// Chỉ import ở server (zod không vào bundle client). Tham số do page bind sẵn vào blockItem / unblockItem đi qua client
// nên parse lại. Đối tượng strict: thêm khóa lạ (VD nhãn do client gửi) → bị chặn; nhãn cảnh báo server tự đọc từ sách.

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)

/**
 * Mục cần chặn: danh mục / tác giả / NXB theo id, hoặc 'warnings' = mọi nhãn ĐÃ DUYỆT của một cuốn ("Ẩn các sách có
 * cảnh báo này", câu 7).
 */
export const blockItemSchema = z.union([
  z.strictObject({ kind: z.enum(['category', 'author', 'publisher']), id }),
  z.strictObject({ kind: z.literal('warnings'), bookId: id }),
])

export type BlockItemInput = z.infer<typeof blockItemSchema>

/** Bỏ chặn theo id dòng user_blocks */
export const unblockItemSchema = z.strictObject({ id })

export type UnblockItemInput = z.infer<typeof unblockItemSchema>
