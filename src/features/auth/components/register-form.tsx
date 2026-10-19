'use client'

import type { ReactNode } from 'react'
import { FormAlert, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'
import { Notice } from './notice'

type Labels = {
  fullName: string
  email: string
  password: string
  passwordHint: string
  submit: string
  pending: string
  checkInboxTitle: string
  /** Có link đăng nhập / quên mật khẩu (server dựng bằng t.rich) */
  checkInbox: ReactNode
}

type Props = {
  action: (prev: Result<{ email: string }> | null, formData: FormData) => Promise<Result<{ email: string }>>
  messages: FormMessages
  labels: Labels
}

export function RegisterForm({ action, messages, labels }: Props) {
  const { state, formProps, pending, formError, quietError, fieldError } = useFormAction(action, messages)

  // Luôn cùng một thông báo dù email đã có tài khoản hay chưa, kể cả khi gửi thư lỗi (không lộ email đã đăng ký)
  if (state?.ok) {
    return (
      <Notice title={labels.checkInboxTitle}>
        <p>{labels.checkInbox}</p>
        <p className="mt-3 font-medium break-all text-foreground">{state.data.email}</p>
      </Notice>
    )
  }

  return (
    <form {...formProps} noValidate className="grid gap-5">
      {formError && <FormAlert quiet={quietError}>{formError}</FormAlert>}
      <TextField
        name="full_name"
        label={labels.fullName}
        autoComplete="name"
        maxLength={100}
        required
        error={fieldError('full_name')}
      />
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
        hint={labels.passwordHint}
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
        error={fieldError('password')}
      />
      <SubmitButton pending={pending} pendingLabel={labels.pending} size="lg" className="h-11 w-full">
        {labels.submit}
      </SubmitButton>
    </form>
  )
}
