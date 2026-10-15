import 'server-only'
import { getTranslations } from 'next-intl/server'
import { ADMIN_VALIDATION_KEYS, type ErrorCode } from '@/lib/errors'
import { getFormMessages, type FormMessages } from '@/lib/form-messages'

/** Chuỗi lỗi cho form admin: mã lỗi dùng chung + FORBIDDEN, lỗi ô dùng chung + admin.validation (chỉ tiếng Việt) */
export async function getAdminFormMessages(codes: ErrorCode[] = []): Promise<FormMessages> {
  const [base, t] = await Promise.all([getFormMessages(['FORBIDDEN', ...codes]), getTranslations('admin.validation')])
  const validation = { ...base.validation }
  for (const key of ADMIN_VALIDATION_KEYS) validation[key] = t(key)
  return { ...base, validation }
}
