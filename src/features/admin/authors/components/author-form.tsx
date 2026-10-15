'use client'

import { AdminLink } from '@/components/admin/admin-link'
import { buttonVariants } from '@/components/ui/button'
import { FormAlert, TextAreaField, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'

export type AuthorFormLabels = {
  name: string
  slug: string
  slugHint: string
  bio: string
  bioEn: string
  bioEnHint: string
  submit: string
  pending: string
  saved: string
  cancel: string
}

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: AuthorFormLabels
  initial: { name: string; slug: string; bio: string | null; bio_en: string | null }
}

export function AuthorForm({ action, messages, labels, initial }: Props) {
  const { state, formProps, pending, formError, quietError, fieldError } = useFormAction(action, messages)

  return (
    <form {...formProps} noValidate className="grid max-w-2xl gap-5">
      {formError && <FormAlert quiet={quietError}>{formError}</FormAlert>}
      <TextField
        name="name"
        label={labels.name}
        defaultValue={initial.name}
        maxLength={200}
        required
        error={fieldError('name')}
      />
      <TextField
        name="slug"
        label={labels.slug}
        defaultValue={initial.slug}
        hint={labels.slugHint}
        maxLength={100}
        autoComplete="off"
        spellCheck={false}
        error={fieldError('slug')}
      />
      <TextAreaField
        name="bio"
        label={labels.bio}
        defaultValue={initial.bio ?? ''}
        rows={6}
        maxLength={10_000}
        error={fieldError('bio')}
      />
      <TextAreaField
        name="bio_en"
        label={labels.bioEn}
        defaultValue={initial.bio_en ?? ''}
        hint={labels.bioEnHint}
        rows={6}
        maxLength={10_000}
        lang="en"
        error={fieldError('bio_en')}
      />
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pending={pending} pendingLabel={labels.pending} size="lg" className="h-11 px-5">
          {labels.submit}
        </SubmitButton>
        <AdminLink href="/admin/tac-gia" className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'h-11 px-5' })}>
          {labels.cancel}
        </AdminLink>
        <p role="status" className="text-sm text-success">
          {state?.ok && !pending ? labels.saved : ''}
        </p>
      </div>
    </form>
  )
}
