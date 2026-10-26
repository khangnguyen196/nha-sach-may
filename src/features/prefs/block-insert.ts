import type { ContentWarning } from '@/features/warnings/labels'
import { toFailure, type Failure, type Result } from '@/lib/errors'
import { missingWarnings } from './blocks'

// Xử lý lỗi khi thêm mục chặn (blockItem): hàm thuần, Vitest được. Không 'use server', không zod.

/** Postgres unique_violation: mục đã có (unique index một phần theo kind) */
const UNIQUE_VIOLATION = '23505'
/** Postgres foreign_key_violation: danh mục / tác giả / NXB vừa bị xóa */
const FOREIGN_KEY_VIOLATION = '23503'
/** Lần insert tối đa của 'warnings' (lần đầu + một lần sau khi tab khác vừa thêm) */
const WARNING_INSERT_ATTEMPTS = 2

export type DbError = { message: string; code?: string | null; details?: string | null }

const OK: Result<null> = { ok: true, data: null }

/**
 * Lỗi insert vào user_blocks → 'duplicate' (đã chặn: coi như thành công) hoặc Failure: 23503 → ITEM_DELETED;
 * PREFS_LIMIT (trigger, detail {"max": 50}) và lỗi khác qua toFailure (mạng → NETWORK_ERROR, JWT → SESSION_EXPIRED…).
 */
export function blockInsertError(error: DbError): 'duplicate' | Failure {
  if (error.code === UNIQUE_VIOLATION) return 'duplicate'
  if (error.code === FOREIGN_KEY_VIOLATION) return { ok: false, code: 'ITEM_DELETED' }
  return toFailure(error)
}

/** Một mục danh mục / tác giả / NXB: trùng = đã chặn → ok */
export function singleBlockResult(error: DbError | null): Result<null> {
  if (!error) return OK
  const outcome = blockInsertError(error)
  return outcome === 'duplicate' ? OK : outcome
}

/**
 * Trigger giới hạn (BEFORE INSERT) chạy trước kiểm trùng: mục đã chặn (VD ở tab khác) khi đã đủ 50 mục báo PREFS_LIMIT
 * thay vì trùng → đọc lại, đã có thì coi như đã chặn. Lỗi đọc → giữ PREFS_LIMIT (log mã lỗi).
 * `exists`: mục này đã có trong user_blocks của user chưa (lỗi đọc → DbError).
 */
export async function confirmLimit(
  result: Result<null>,
  exists: () => Promise<boolean | DbError>,
): Promise<Result<null>> {
  if (result.ok || result.code !== 'PREFS_LIMIT') return result
  const found = await exists()
  if (found === true) return OK
  if (found !== false) console.error('[prefs] confirmLimit:', found.code ?? 'unknown')
  return result
}

/**
 * "Ẩn các sách có cảnh báo này": thêm các nhãn của sách còn thiếu trong MỘT câu insert (nguyên tử: chạm PREFS_LIMIT thì
 * không nhãn nào được thêm). Trùng (tab khác vừa thêm một nhãn) → đọc lại, insert phần còn thiếu thêm một lần.
 * `readBlocked`: nhãn đang bị chặn của user (lỗi → Failure); `insert`: thêm đúng các nhãn truyền vào.
 */
export async function blockMissingWarnings(
  bookLabels: readonly string[],
  readBlocked: () => Promise<Result<readonly string[]>>,
  insert: (labels: ContentWarning[]) => Promise<DbError | null>,
): Promise<Result<null>> {
  for (let attempt = 0; ; attempt++) {
    const blocked = await readBlocked()
    if (!blocked.ok) return blocked
    const missing = missingWarnings(bookLabels, blocked.data)
    if (missing.length === 0) return OK
    if (attempt === WARNING_INSERT_ATTEMPTS) return { ok: false, code: 'UNKNOWN' }
    const error = await insert(missing)
    if (!error) return OK
    const outcome = blockInsertError(error)
    if (outcome !== 'duplicate') return outcome
  }
}
