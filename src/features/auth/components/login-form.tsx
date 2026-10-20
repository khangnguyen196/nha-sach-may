'use client'

import { FormAlert, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Link } from '@/i18n/navigation'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'
import { NextField } from './next-field'
import { ResendConfirmation, type ResendLabels } from './resend-confirmation'

type Labels = { email: string; password: string; submit: string; pending: string; forgot: string; noScript: string }

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  /** Gửi lại email xác nhận (hiện khi đăng nhập gặp EMAIL_NOT_CONFIRMED) */
  resend: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: Labels
  resendLabels: ResendLabels
}

/** Form đăng nhập; trang quay lại sau đăng nhập lấy từ `?next=` ở client (NextField), thông báo của URL nằm ngoài form */
export function LoginForm({ action, resend, messages, labels, resendLabels }: Props) {
  const { state, formProps, pending, formError: error, quietError, fieldError } = useFormAction(action, messages)
  const unconfirmed = state && !state.ok && state.code === 'EMAIL_NOT_CONFIRMED' ? state.details?.email : undefined

  return (
    <div className="grid gap-5">
      <form {...formProps} noValidate className="grid gap-5">
        {error && <FormAlert quiet={quietError}>{error}</FormAlert>}
        <NextField />
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
        <noscript>
          {/* Không JS: POST trả về chỉ phần động của trang (Cache Components), trình duyệt hiện trang trắng
              (docs/plans/no-js.md, đo cả production) → báo trước ngay trên nút gửi */}
          <p className="text-base text-muted-foreground" data-testid="no-script-submit">
            {labels.noScript}
          </p>
        </noscript>
        <SubmitButton pending={pending} pendingLabel={labels.pending} size="lg" className="h-11 w-full">
          {labels.submit}
        </SubmitButton>
      </form>
      {/* Form riêng, sau form đăng nhập (form không lồng nhau được); key theo email: đổi email thì đếm lại từ đầu */}
      {typeof unconfirmed === 'string' && (
        <ResendConfirmation key={unconfirmed} action={resend} messages={messages} labels={resendLabels} email={unconfirmed} />
      )}
    </div>
  )
}
