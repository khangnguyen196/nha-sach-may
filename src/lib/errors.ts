// Mã lỗi do RPC/trigger trả về (danh sách ở cuối supabase/schema.sql), mã của luồng đăng nhập (map từ
// AuthError.code trong features/auth/errors.ts) + UNKNOWN.
// Mỗi mã phải có bản dịch ở messages/*.json → errors.<CODE> (có test kiểm tra).
export const ERROR_CODES = [
  'AUTH_REQUIRED',
  'INVALID_ADDRESS',
  'BOOK_UNAVAILABLE',
  'OUT_OF_STOCK',
  'CART_EMPTY',
  'INVALID_VOUCHER',
  'VOUCHER_MIN_ORDER',
  'ORDER_NOT_CANCELLABLE',
  'ORDER_REOPEN_FORBIDDEN',
  'INVALID_INPUT',
  'CART_CHANGED',
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'EMAIL_NOT_CONFIRMED',
  'WEAK_PASSWORD',
  'SAME_PASSWORD',
  'RATE_LIMITED',
  'LINK_EXPIRED',
  'UNKNOWN',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]
export type ErrorDetails = Record<string, string | number>

// Lỗi từng ô của form: message trong zod schema là một khóa ở messages/*.json → validation.<KEY> (có test)
export const VALIDATION_KEYS = [
  'required',
  'email',
  'passwordMin',
  'passwordMax',
  'fullName',
  'recipientName',
  'phone',
  'province',
  'ward',
  'street',
  'address',
  'note',
  'reason',
  'invalid',
] as const

export type ValidationKey = (typeof VALIDATION_KEYS)[number]
export type FieldErrors = Partial<Record<string, ValidationKey>>

export type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false
      code: ErrorCode
      details?: ErrorDetails
      fieldErrors?: FieldErrors
      /** Chuỗi đã dịch, cho lỗi có tham số ICU hiện ở client leaf (lib/error-message.ts) */
      message?: string
    }

export type Failure = Extract<Result<never>, { ok: false }>

export function isErrorCode(value: string): value is ErrorCode {
  return ERROR_CODES.some((code) => code === value)
}

function isValidationKey(value: string): value is ValidationKey {
  return VALIDATION_KEYS.some((key) => key === value)
}

/** Lỗi zod → INVALID_INPUT kèm lỗi đầu tiên của từng ô (message lạ, VD lỗi kiểu mặc định của zod → `invalid`) */
export function invalidInput(error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }): Failure {
  const fieldErrors: FieldErrors = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field !== 'string' || fieldErrors[field]) continue
    fieldErrors[field] = isValidationKey(issue.message) ? issue.message : 'invalid'
  }
  return { ok: false, code: 'INVALID_INPUT', fieldErrors }
}

/** DETAIL của raise exception là JSON; giữ lại các giá trị dùng được làm tham số ICU */
function parseDetails(details: string | null | undefined): ErrorDetails | undefined {
  if (!details) return undefined
  try {
    const parsed: unknown = JSON.parse(details)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
    const entries = Object.entries(parsed).filter(
      (entry): entry is [string, string | number] => typeof entry[1] === 'string' || typeof entry[1] === 'number',
    )
    return entries.length > 0 ? Object.fromEntries(entries) : undefined
  } catch {
    return undefined
  }
}

/** Đổi lỗi PostgREST (message = mã lỗi do `raise exception` đặt) thành Result thất bại */
export function toFailure(error: { message: string; details?: string | null }): Failure {
  const code = isErrorCode(error.message) ? error.message : 'UNKNOWN'
  const details = code === 'UNKNOWN' ? undefined : parseDetails(error.details)
  return details ? { ok: false, code, details } : { ok: false, code }
}
