import 'server-only'
import { getTranslations } from 'next-intl/server'
import { VALIDATION_KEYS, type ErrorCode, type ValidationKey } from './errors'
import { SUPPORT_EMAIL } from './support'

/** Link "Đăng nhập lại" khi phiên hết giữa chừng: `next` là URL hiển thị của trang đang mở (quay lại sau khi đăng nhập) */
export type SignInLink = { next: string; label: string }

/** Chuỗi lỗi đã dịch truyền xuống form client (client leaf không dùng useTranslations, xem CLAUDE.md → i18n) */
export type FormMessages = {
  /** UNKNOWN, NETWORK_ERROR: form nào cũng có thể gặp (useFormAction đổi lỗi mạng ở client thành NETWORK_ERROR) */
  errors: Partial<Record<ErrorCode, string>> & { UNKNOWN: string; NETWORK_ERROR: string }
  validation: Partial<Record<ValidationKey, string>>
  /** Có khi trang truyền `signInNext`: lỗi AUTH_REQUIRED / SESSION_EXPIRED kèm link đăng nhập về đúng trang */
  signIn?: SignInLink
}

/**
 * `codes`: mã lỗi form có thể trả về. Chỉ mã không có tham số ICU (OUT_OF_STOCK… cần giá trị lúc dịch).
 * `signInNext`: URL hiển thị của trang (getPathname) → form có link "Đăng nhập lại" khi phiên hết giữa chừng.
 */
export async function getFormMessages(
  codes: ErrorCode[],
  { signInNext }: { signInNext?: string } = {},
): Promise<FormMessages> {
  const [tErrors, tValidation, tCommon] = await Promise.all([
    getTranslations('errors'),
    getTranslations('validation'),
    getTranslations('common'),
  ])
  // INVALID_INPUT, SESSION_EXPIRED (JWT hết hạn, toFailure): form nào gửi Server Action cũng có thể gặp
  const all: ErrorCode[] = [...codes, 'INVALID_INPUT', 'SESSION_EXPIRED']
  const errors: Partial<Record<ErrorCode, string>> = {}
  // Câu cần hỗ trợ (UNKNOWN…) có {email}; câu khác bỏ qua tham số thừa
  const values = { email: SUPPORT_EMAIL }
  for (const code of all) errors[code] = tErrors(code, values)
  const validation: Partial<Record<ValidationKey, string>> = {}
  for (const key of VALIDATION_KEYS) validation[key] = tValidation(key)
  return {
    errors: { ...errors, UNKNOWN: tErrors('UNKNOWN', values), NETWORK_ERROR: tErrors('NETWORK_ERROR', values) },
    validation,
    ...(signInNext ? { signIn: { next: signInNext, label: tCommon('signInAgain') } } : {}),
  }
}
