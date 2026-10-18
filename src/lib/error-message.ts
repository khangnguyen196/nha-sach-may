import 'server-only'
import type { Locale } from 'next-intl'
import { getFormatter, getTranslations } from 'next-intl/server'
import { errorMessageValues } from './error-values'
import type { Failure } from './errors'

/**
 * Gắn chuỗi lỗi đã dịch (kèm tham số ICU từ `details`, VD OUT_OF_STOCK: title, stock; thời điểm như starts_at được
 * format theo ngày giờ; `email` liên hệ luôn có) vào Failure.
 * Server Action không đọc được next/root-params → locale truyền tường minh (page bind sẵn).
 * Chỉ dùng cho Failure mà `details` có đủ tham số của message; thiếu thì next-intl trả về tên khóa.
 */
export async function withMessage(locale: Locale, failure: Failure): Promise<Failure> {
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: 'errors' }), getFormatter({ locale })])
  const values = errorMessageValues(failure.details, (date) => format.dateTime(date, 'withTime'))
  return { ...failure, message: t(failure.code, values) }
}
