import 'server-only'
import { getTranslations } from 'next-intl/server'
import { VALIDATION_KEYS, type ErrorCode, type ValidationKey } from './errors'

/** Chuỗi lỗi đã dịch truyền xuống form client (client leaf không dùng useTranslations, xem CLAUDE.md → i18n) */
export type FormMessages = {
  /** UNKNOWN, NETWORK_ERROR: form nào cũng có thể gặp (useFormAction đổi lỗi mạng ở client thành NETWORK_ERROR) */
  errors: Partial<Record<ErrorCode, string>> & { UNKNOWN: string; NETWORK_ERROR: string }
  validation: Partial<Record<ValidationKey, string>>
}

/** `codes`: mã lỗi form có thể trả về. Chỉ mã không có tham số ICU (OUT_OF_STOCK… cần giá trị lúc dịch). */
export async function getFormMessages(codes: ErrorCode[]): Promise<FormMessages> {
  const [tErrors, tValidation] = await Promise.all([getTranslations('errors'), getTranslations('validation')])
  const all: ErrorCode[] = [...codes, 'INVALID_INPUT']
  const errors: Partial<Record<ErrorCode, string>> = {}
  for (const code of all) errors[code] = tErrors(code)
  const validation: Partial<Record<ValidationKey, string>> = {}
  for (const key of VALIDATION_KEYS) validation[key] = tValidation(key)
  return { errors: { ...errors, UNKNOWN: tErrors('UNKNOWN'), NETWORK_ERROR: tErrors('NETWORK_ERROR') }, validation }
}
