'use client'

import { FormAlert, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'
import { Notice } from './notice'

type Labels = { email: string; submit: string; pending: string; sentTitle: string; sent: string }

type Props = {
  action: (prev: Result<{ email: string }> | null, formData: FormData) => Promise<Result<{ email: string }>>
  messages: FormMessages
  labels: Labels
}

export function ForgotPasswordForm({ action, messages, labels }: Props) {
  const { state, formProps, pending, formError: error, quietError, fieldError } = useFormAction(action, messages)

  if (state?.ok) {
    return (
      <Notice title={labels.sentTitle}>
        <p>{labels.sent}</p>
        <p className="mt-3 font-medium break-all text-foreground">{state.data.email}</p>
      </Notice>
    )
  }

  return (
    <form {...formProps} noValidate className="grid gap-5">
      {error && <FormAlert quiet={quietError}>{error}</FormAlert>}
      <TextField
        name="email"
        type="email"
        label={labels.email}
        autoComplete="email"
        required
        error={fieldError('email')}
      />
      <SubmitButton pending={pending} pendingLabel={labels.pending} size="lg" className="h-11 w-full">
        {labels.submit}
      </SubmitButton>
    </form>
  )
}
