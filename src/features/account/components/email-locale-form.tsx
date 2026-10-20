'use client'

import { SignInAgainLink } from '@/components/layout/sign-in-again-link'
import { FormAlert, SelectField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'

type Labels = { label: string; description: string; save: string; saved: string; pending: string }

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: Labels
  options: { value: string; label: string }[]
  defaultValue: string
}

export function EmailLocaleForm({ action, messages, labels, options, defaultValue }: Props) {
  const { state, formProps, pending, ready, formError, signIn } = useFormAction(action, messages)

  return (
    <form {...formProps} className="grid gap-4">
      {formError && <FormAlert action={signIn && <SignInAgainLink signIn={signIn} />}>{formError}</FormAlert>}
      <SelectField name="locale" label={labels.label} hint={labels.description} defaultValue={defaultValue}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <div className="flex items-center gap-3">
        <SubmitButton
          pending={pending}
          ready={ready}
          pendingLabel={labels.pending}
          variant="secondary"
          size="lg"
          className="h-10 px-4"
        >
          {labels.save}
        </SubmitButton>
        <p role="status" className="text-sm text-success">
          {state?.ok && !pending ? labels.saved : ''}
        </p>
      </div>
    </form>
  )
}
