import 'server-only'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import type { Failure } from './errors'

/**
 * Gắn chuỗi lỗi đã dịch (kèm tham số ICU từ `details`, VD OUT_OF_STOCK: title, stock) vào Failure.
 * Server Action không đọc được next/root-params → locale truyền tường minh (page bind sẵn).
 * Chỉ dùng cho Failure mà `details` có đủ tham số của message; thiếu thì next-intl trả về tên khóa.
 */
export async function withMessage(locale: Locale, failure: Failure): Promise<Failure> {
  const t = await getTranslations({ locale, namespace: 'errors' })
  return { ...failure, message: t(failure.code, failure.details) }
}
