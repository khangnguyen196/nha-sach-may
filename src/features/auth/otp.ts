import type { EmailOtpType } from '@supabase/supabase-js'

/** Loại link trong email auth mà app xử lý (template Supabase, docs/plans/phase-9.md) */
export const OTP_TYPES = ['email', 'signup', 'recovery', 'email_change'] as const satisfies EmailOtpType[]

export type OtpType = (typeof OTP_TYPES)[number]

export function toOtpType(value: unknown): OtpType | undefined {
  return OTP_TYPES.find((type) => type === value)
}

/** token_hash của Supabase: chuỗi hex / base64url; giới hạn độ dài để không phản chiếu chuỗi tùy ý vào trang */
export function toTokenHash(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,200}$/.test(value) ? value : undefined
}
