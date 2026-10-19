// Mã lỗi do RPC/trigger trả về (danh sách ở cuối supabase/schema.sql), mã của luồng đăng nhập (map từ
// AuthError.code trong features/auth/errors.ts), mã của admin + UNKNOWN.
// Mỗi mã phải có bản dịch ở messages/*.json → errors.<CODE> (có test kiểm tra).
export const ERROR_CODES = [
  'AUTH_REQUIRED',
  'INVALID_ADDRESS',
  'BOOK_UNAVAILABLE',
  'OUT_OF_STOCK',
  'CART_EMPTY',
  // Mã giảm giá không dùng được, theo lý do (ux-messages B)
  'VOUCHER_NOT_FOUND',
  'VOUCHER_INACTIVE',
  'VOUCHER_NOT_STARTED',
  'VOUCHER_EXPIRED',
  'VOUCHER_EXHAUSTED',
  'VOUCHER_MIN_ORDER',
  // Khách tự hủy đơn không được, theo lý do (ux-messages B). ORDER_NOT_CANCELLABLE: đơn không có / của tài khoản khác
  'ORDER_NOT_CANCELLABLE',
  'ORDER_ALREADY_CANCELLED',
  'ORDER_DELIVERED',
  'ORDER_IN_PROGRESS',
  'ORDER_PAID',
  'ORDER_REOPEN_FORBIDDEN',
  'ORDER_INVALID_TRANSITION',
  'INVALID_INPUT',
  'CART_CHANGED',
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'EMAIL_NOT_CONFIRMED',
  'WEAK_PASSWORD',
  'SAME_PASSWORD',
  'RATE_LIMITED',
  'LINK_EXPIRED',
  // Auth (ux-messages): Supabase tắt đăng ký, tài khoản bị khóa, phiên đăng nhập hết hạn giữa chừng
  'SIGNUP_DISABLED',
  'ACCOUNT_LOCKED',
  'SESSION_EXPIRED',
  // Admin (Phase 7): không có quyền, slug trùng, ảnh bìa, xóa / đổi cha khi còn sách
  'FORBIDDEN',
  'SLUG_TAKEN',
  'COVER_TOO_LARGE',
  'COVER_INVALID',
  'CATEGORY_HAS_BOOKS',
  'AUTHOR_HAS_BOOKS',
  // Admin 7b: đơn vừa đổi trạng thái ở nơi khác (update có điều kiện khớp 0 dòng), voucher trùng mã / đã có đơn dùng
  'ORDER_STATUS_CHANGED',
  'VOUCHER_CODE_TAKEN',
  'VOUCHER_IN_USE',
  // Admin (ux-messages): mục vừa bị xóa ở tab / máy khác (update khớp 0 dòng); lưu sách xong nhưng lỗi bảng tác giả
  'ITEM_DELETED',
  'BOOK_AUTHORS_NOT_SAVED',
  // Phase 9: viết đánh giá khi chưa nhận sách (RLS reviews_insert_if_purchased)
  'REVIEW_NOT_ALLOWED',
  // Phase 11, chatbot Mây: hết lượt của khách (consume_chat_quota), hết lượt miễn phí của Gemini (trần chung / 429),
  // không dùng được (chưa cấu hình, lỗi AI / mạng), khu vực không được phục vụ (EEA / Anh / Thụy Sĩ)
  'CHAT_QUOTA_EXCEEDED',
  'CHAT_FREE_QUOTA',
  'CHAT_UNAVAILABLE',
  'CHAT_REGION',
  // Không tới được máy chủ: request Server Action fail ở client, hoặc server không gọi được Supabase
  'NETWORK_ERROR',
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
  'rating',
  'reviewContent',
  // Supabase Auth từ chối (ux-messages): mật khẩu dễ đoán / đã lộ, trùng mật khẩu cũ
  'passwordWeak',
  'passwordSame',
  'invalid',
] as const

// Lỗi từng ô của form admin: khóa ở messages/vi.json → admin.validation.<KEY> (admin chỉ tiếng Việt, có test)
export const ADMIN_VALIDATION_KEYS = [
  'title',
  'subtitle',
  'name',
  'slug',
  'slugTaken',
  'description',
  'isbn',
  'isbnTaken',
  'price',
  'originalPrice',
  'stock',
  'year',
  'positiveInt',
  'dimensions',
  'sortOrder',
  'category',
  'categoryLeaf',
  'categoryDepth',
  'categoryHasChildren',
  'categoryHasBooks',
  'coverRequired',
  'coverTooLarge',
  'coverInvalid',
  'cancelReason',
  'voucherCode',
  'voucherCodeTaken',
  'voucherDescription',
  'discountType',
  'discountValue',
  'discountPercent',
  'minOrder',
  'dateTime',
  'endsAfterStarts',
] as const

export type ValidationKey = (typeof VALIDATION_KEYS)[number] | (typeof ADMIN_VALIDATION_KEYS)[number]
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
  return VALIDATION_KEYS.some((key) => key === value) || ADMIN_VALIDATION_KEYS.some((key) => key === value)
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

/**
 * postgrest-js không gọi được server (fetch ném lỗi) → error.code rỗng, message = "<tên lỗi>: <message>"
 * (VD "TypeError: fetch failed", "TimeoutError: …"); lỗi do Postgres / PostgREST trả luôn có code.
 */
const FETCH_FAILURE = /^(TypeError|AbortError|TimeoutError|FetchError|Error): /

export function isNetworkFailure(error: { message: string; code?: string | null }) {
  return !error.code && FETCH_FAILURE.test(error.message)
}

// PostgREST từ chối JWT (hết hạn / không đọc được): phiên đăng nhập cũ, không phải lỗi của web
const JWT_REJECTED = new Set(['PGRST301', 'PGRST302', 'PGRST303'])
// Postgres insufficient_privilege: RLS / quyền cột chặn ghi
const PRIVILEGE_DENIED = '42501'

/** Đổi lỗi PostgREST (message = mã lỗi do `raise exception` đặt) thành Result thất bại */
export function toFailure(error: { message: string; details?: string | null; code?: string | null }): Failure {
  if (isNetworkFailure(error)) return { ok: false, code: 'NETWORK_ERROR' }
  if (error.code && JWT_REJECTED.has(error.code)) return { ok: false, code: 'SESSION_EXPIRED' }
  if (error.code === PRIVILEGE_DENIED && !isErrorCode(error.message)) return { ok: false, code: 'FORBIDDEN' }
  const code = isErrorCode(error.message) ? error.message : 'UNKNOWN'
  const details = code === 'UNKNOWN' ? undefined : parseDetails(error.details)
  return details ? { ok: false, code, details } : { ok: false, code }
}
