'use client'

import { AdminLink, type AdminHref } from '@/components/admin/admin-link'
import { CheckboxField } from '@/components/admin/checkbox-field'
import { buttonVariants } from '@/components/ui/button'
import { FormAlert, SelectField, TextAreaField, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'

export type CategoryFormLabels = {
  name: string
  nameEn: string
  nameEnHint: string
  slug: string
  slugHint: string
  description: string
  descriptionEn: string
  parent: string
  noParent: string
  parentHint: string
  sortOrder: string
  sortOrderHint: string
  active: string
  activeHint: string
  hidden: string
  submit: string
  pending: string
  saved: string
  cancel: string
}

export type CategoryFormValues = {
  name: string
  name_en: string | null
  slug: string
  description: string | null
  description_en: string | null
  parent_id: number | null
  sort_order: number
  is_active: boolean
}

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: CategoryFormLabels
  initial: CategoryFormValues
  /** Danh mục gốc (trừ chính nó) chọn làm cha */
  parents: { id: number; name: string; is_active: boolean }[]
  cancelHref: AdminHref
}

export function CategoryForm({ action, messages, labels, initial, parents, cancelHref }: Props) {
  const { state, formProps, pending, ready, formError, quietError, fieldError } = useFormAction(action, messages)

  return (
    <form {...formProps} noValidate className="grid max-w-2xl gap-5">
      {formError && <FormAlert quiet={quietError}>{formError}</FormAlert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="name"
          label={labels.name}
          defaultValue={initial.name}
          maxLength={200}
          required
          error={fieldError('name')}
        />
        <TextField
          name="name_en"
          label={labels.nameEn}
          defaultValue={initial.name_en ?? ''}
          hint={labels.nameEnHint}
          maxLength={200}
          lang="en"
          error={fieldError('name_en')}
        />
      </div>
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
        name="description"
        label={labels.description}
        defaultValue={initial.description ?? ''}
        rows={3}
        maxLength={2_000}
        error={fieldError('description')}
      />
      <TextAreaField
        name="description_en"
        label={labels.descriptionEn}
        defaultValue={initial.description_en ?? ''}
        rows={3}
        maxLength={2_000}
        lang="en"
        error={fieldError('description_en')}
      />
      <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SelectField
          name="parent_id"
          label={labels.parent}
          defaultValue={initial.parent_id ?? ''}
          hint={labels.parentHint}
          error={fieldError('parent_id')}
        >
          <option value="">{labels.noParent}</option>
          {parents.map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.is_active ? parent.name : `${parent.name} (${labels.hidden})`}
            </option>
          ))}
        </SelectField>
        <TextField
          name="sort_order"
          type="text"
          inputMode="numeric"
          label={labels.sortOrder}
          defaultValue={initial.sort_order}
          hint={labels.sortOrderHint}
          required
          error={fieldError('sort_order')}
        />
      </div>
      <CheckboxField name="is_active" label={labels.active} hint={labels.activeHint} defaultChecked={initial.is_active} />
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pending={pending} ready={ready} pendingLabel={labels.pending} size="lg" className="h-11 px-5">
          {labels.submit}
        </SubmitButton>
        <AdminLink href={cancelHref} className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'h-11 px-5' })}>
          {labels.cancel}
        </AdminLink>
        <p role="status" className="text-sm text-success">
          {state?.ok && !pending ? labels.saved : ''}
        </p>
      </div>
    </form>
  )
}
