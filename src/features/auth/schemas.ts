import type { Locale } from 'next-intl'
import { z } from 'zod'
import { routing } from '@/i18n/routing'
import type { ValidationKey } from '@/lib/errors'

// Message của từng ràng buộc là khóa ở messages/*.json → validation (lib/errors.ts → invalidInput)
const error = (key: ValidationKey) => ({ error: key })

export const localeSchema = z.enum(routing.locales)

/** Locale từ nguồn không tin được (tham số bind của Server Action, query của link email); sai → vi */
export function parseLocale(value: unknown): Locale {
  const parsed = localeSchema.safeParse(value)
  return parsed.success ? parsed.data : routing.defaultLocale
}

const email = z
  .string(error('required'))
  .trim()
  .toLowerCase()
  .min(1, error('required'))
  .pipe(z.email(error('email')))

// 72: giới hạn bcrypt của Supabase Auth (phần sau bị bỏ qua nếu dài hơn)
const newPassword = z.string(error('required')).min(8, error('passwordMin')).max(72, error('passwordMax'))

export const signInSchema = z.object({
  email,
  // Không áp quy tắc độ dài khi đăng nhập: chỉ cần có nhập, kiểm tra đúng sai là việc của Supabase
  password: z.string(error('required')).min(1, error('required')),
  next: z.string().optional(),
})

export const signUpSchema = z.object({
  email,
  password: newPassword,
  full_name: z.string(error('required')).trim().min(1, error('fullName')).max(100, error('fullName')),
})

export const passwordResetRequestSchema = z.object({ email })

export const updatePasswordSchema = z.object({ password: newPassword })
