'use client'

import { buttonVariants } from '@/components/ui/button'
import { FormAlert, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Link } from '@/i18n/navigation'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'
import { Notice } from './notice'

type Labels = {
  newPassword: string
  passwordHint: string
  submit: string
  pending: string
  successTitle: string
  success: string
  goToAccount: string
}

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: Labels
}

export function ResetPasswordForm({ action, messages, labels }: Props) {
  const { state, formProps, pending, formError, quietError, fieldError } = useFormAction(action, messages)

  if (state?.ok) {
    return (
      <Notice
        title={labels.successTitle}
        action={
          <Link href="/account" className={buttonVariants({ size: 'lg', className: 'h-11 px-5' })}>
            {labels.goToAccount}
          </Link>
        }
      >
        <p>{labels.success}</p>
      </Notice>
    )
  }

  return (
    <form {...formProps} noValidate className="grid gap-5">
      {formError && <FormAlert quiet={quietError}>{formError}</FormAlert>}
      <TextField
        name="password"
        type="password"
        label={labels.newPassword}
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
