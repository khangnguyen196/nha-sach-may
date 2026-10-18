import { BLOCKED_COUNTRIES } from './config'

/** x-vercel-ip-country thuộc EEA / Anh / Thụy Sĩ. Không có header (chạy local, ngoài Vercel) → không chặn. */
export function isBlockedCountry(country: string | null | undefined): boolean {
  const code = country?.trim().toUpperCase()
  if (!code) return false
  return BLOCKED_COUNTRIES.some((blocked) => blocked === code)
}
