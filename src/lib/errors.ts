// Mã lỗi do RPC/trigger trả về (danh sách ở cuối supabase/schema.sql) + UNKNOWN.
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
  'UNKNOWN',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]
export type ErrorDetails = Record<string, string | number>

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; details?: ErrorDetails }

function isErrorCode(value: string): value is ErrorCode {
  return ERROR_CODES.some((code) => code === value)
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
export function toFailure(error: { message: string; details?: string | null }): Extract<Result<never>, { ok: false }> {
  const code = isErrorCode(error.message) ? error.message : 'UNKNOWN'
  const details = code === 'UNKNOWN' ? undefined : parseDetails(error.details)
  return details ? { ok: false, code, details } : { ok: false, code }
}
