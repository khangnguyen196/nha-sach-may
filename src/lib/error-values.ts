import type { ErrorDetails } from './errors'
import { SUPPORT_EMAIL } from './support'

// Detail là thời điểm (ISO, từ json_build_object của DB) → hiện theo ngày giờ của khách thay vì chuỗi ISO
const DATE_DETAILS = new Set(['starts_at', 'ends_at'])

/**
 * Tham số ICU cho câu errors.<CODE>: `details` của lỗi + `email` (email liên hệ, câu nào không dùng thì bỏ qua).
 * `formatDate`: formatter của next-intl theo locale + múi giờ của app.
 */
export function errorMessageValues(
  details: ErrorDetails | undefined,
  formatDate: (date: Date) => string,
): Record<string, string | number> {
  const values: Record<string, string | number> = { email: SUPPORT_EMAIL }
  for (const [key, value] of Object.entries(details ?? {})) {
    const date = DATE_DETAILS.has(key) && typeof value === 'string' ? new Date(value) : null
    values[key] = date && !Number.isNaN(date.getTime()) ? formatDate(date) : value
  }
  return values
}
