'use client'

import { FormAlert, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Link } from '@/i18n/navigation'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'

type Labels = { email: string; password: string; submit: string; pending: string; forgot: string }

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: Labels
  /** Trang quay lại sau khi đăng nhập (đã lọc ở server, server action lọc lại) */
  next?: string
  /** Lỗi mang theo từ URL, VD link xác nhận hết hạn (?error=LINK_EXPIRED) */
  initialError?: string
}

export function LoginForm({ action, messages, labels, next, initialError }: Props) {
  const { formProps, pending, formError, quietError, fieldError } = useFormAction(action, messages)
  const error = formError ?? initialError

  return (
    <form {...formProps} noValidate className="grid gap-5">
      {error && <FormAlert quiet={quietError}>{error}</FormAlert>}
      {next && <input type="hidden" name="next" value={next} />}
      <TextField
        name="email"
        type="email"
        label={labels.email}
        autoComplete="email"
        required
        error={fieldError('email')}
      />
      <TextField
        name="password"
        type="password"
        label={labels.password}
        autoComplete="current-password"
        required
        error={fieldError('password')}
        labelAside={
          <Link
            href="/forgot-password"
            className="rounded-sm text-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {labels.forgot}
          </Link>
        }
      />
      <SubmitButton pending={pending} pendingLabel={labels.pending} size="lg" className="h-11 w-full">
        {labels.submit}
      </SubmitButton>
    </form>
  )
}
