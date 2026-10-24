import type { Failure } from '@/lib/errors'

/**
 * Lỗi Storage khi tải ảnh tin lên (hình dạng của storage-js 2.x, `StorageError`):
 * - `StorageApiError`: máy chủ trả lỗi; `status` = mã HTTP (number), `statusCode` = `statusCode` / `code` trong body
 *   (chuỗi, VD "403"), `code` = mã lỗi của Storage trong body (VD `InvalidJWT`, `AccessDenied`; bản storage-js mới),
 *   `message` = message của body.
 * - `StorageUnknownError`: không tới được máy chủ (fetch ném lỗi); `status`, `statusCode` đều undefined.
 * `upload()` khai kiểu lỗi là `StorageError` (không có `code`) nên `code` để tùy chọn.
 */
export type StorageUploadError = { message: string; status?: number; statusCode?: string; code?: string | undefined }

/** Policy của bucket chặn (trần 30 ảnh / người; tên ảnh và thư mục do server tạo nên luôn đúng mẫu) */
const RLS_DENIED = /row-level security/i
/** JWT hết hạn / không hợp lệ: "jwt expired", `"exp" claim timestamp check failed`, "Unauthorized" */
const JWT_REJECTED = /jwt|"exp"|\bexp\b|unauthorized/i
const AUTH_STATUSES = new Set(['400', '403'])

/**
 * Lỗi tải ảnh → mã của form: chạm trần ảnh → LISTING_PHOTO_LIMIT; phiên hết hạn → SESSION_EXPIRED; không tới được
 * máy chủ → NETWORK_ERROR; còn lại → UNKNOWN. Log chỉ ghi status / statusCode, không ghi message (có thể chứa đường dẫn
 * ảnh = id người bán, hay dữ liệu khác của request).
 */
export function uploadFailure(error: StorageUploadError): Failure {
  // Mã lỗi có cấu trúc của Storage: không phụ thuộc câu chữ message
  if (error.code === 'InvalidJWT') return { ok: false, code: 'SESSION_EXPIRED' }
  if (RLS_DENIED.test(error.message)) return { ok: false, code: 'LISTING_PHOTO_LIMIT' }
  if (error.status === undefined && error.statusCode === undefined) return { ok: false, code: 'NETWORK_ERROR' }
  // Storage cũ trả HTTP 400 kèm statusCode "403" trong body; bản mới trả thẳng 403
  const authStatus = [String(error.status), error.statusCode].some((value) => AUTH_STATUSES.has(value ?? ''))
  if (authStatus && JWT_REJECTED.test(error.message)) return { ok: false, code: 'SESSION_EXPIRED' }
  console.error('uploadListingPhoto:', error.status, error.statusCode)
  return { ok: false, code: 'UNKNOWN' }
}
