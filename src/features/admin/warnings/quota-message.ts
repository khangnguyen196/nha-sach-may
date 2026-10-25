import 'server-only'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { SuggestQuotaScope } from '@/features/warnings/suggest'
import type { Failure } from '@/lib/errors'

// Câu WARNING_QUOTA_EXCEEDED theo scope cho admin (namespace admin.warnings.quota, chỉ tiếng Việt). Server Action không
// đọc được next/root-params → locale viết thẳng. Scope null (detail hỏng) → không gắn message: form hiện câu chung
// errors.WARNING_QUOTA_EXCEEDED (trung tính, không nói lý do).

const ADMIN_LOCALE = 'vi'

export type WarningQuotaKind = 'minute' | 'day' | 'chatReserve'

/**
 * Phút (warn_minute; gemini_minute: trần chung / 429 của Google) → thử lại sau ít phút. Ngày (warn_day; gemini_day: 429
 * theo ngày của Google) → hết lượt hôm nay. Chỉ chat_reserve (ngưỡng gemini:day chừa cho Mây) nói tới chatbot Mây.
 */
export function warningQuotaKind(scope: SuggestQuotaScope | null): WarningQuotaKind | null {
  switch (scope) {
    case 'warn_minute':
    case 'gemini_minute':
      return 'minute'
    case 'warn_day':
    case 'gemini_day':
      return 'day'
    case 'chat_reserve':
      return 'chatReserve'
    case null:
      return null
  }
}

/** Giờ reset theo giờ Việt Nam: formatter của next-intl (timeZone Asia/Ho_Chi_Minh ở i18n/request.ts), mẫu withTime */
export async function warningQuotaFailure(scope: SuggestQuotaScope | null, resetsAt: Date | null): Promise<Failure> {
  const failure: Failure = { ok: false, code: 'WARNING_QUOTA_EXCEEDED' }
  const kind = warningQuotaKind(scope)
  if (kind === null) return failure
  const [t, format] = await Promise.all([
    getTranslations({ locale: ADMIN_LOCALE, namespace: 'admin.warnings.quota' }),
    getFormatter({ locale: ADMIN_LOCALE }),
  ])
  if (kind === 'minute') return { ...failure, message: t('minute') }
  const time = resetsAt ? format.dateTime(resetsAt, 'withTime') : null
  if (kind === 'day') return { ...failure, message: time ? t('day', { time }) : t('dayNoTime') }
  return { ...failure, message: time ? t('chatReserve', { time }) : t('chatReserveNoTime') }
}
