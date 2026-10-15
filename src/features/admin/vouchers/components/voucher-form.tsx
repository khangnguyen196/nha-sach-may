'use client'

import { AdminLink } from '@/components/admin/admin-link'
import { CheckboxField } from '@/components/admin/checkbox-field'
import { buttonVariants } from '@/components/ui/button'
import { FormAlert, SelectField, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'

export type VoucherFormLabels = {
  code: string
  codeHint: string
  description: string
  descriptionEn: string
  descriptionEnHint: string
  discountType: string
  types: { percent: string; fixed: string }
  discountValue: string
  discountValueHint: string
  maxDiscount: string
  maxDiscountHint: string
  minOrder: string
  minOrderHint: string
  usageLimit: string
  usageLimitHint: string
  startsAt: string
  endsAt: string
  periodHint: string
  active: string
  activeHint: string
  submit: string
  pending: string
  saved: string
  cancel: string
}

/** Giá trị ban đầu của các ô (số để trống = chuỗi rỗng, thời gian đã đổi sang giờ VN cho ô datetime-local) */
export type VoucherFormValues = {
  code: string
  description: string
  description_en: string
  discount_type: 'percent' | 'fixed'
  discount_value: string
  max_discount: string
  min_order_value: string
  usage_limit: string
  starts_at: string
  ends_at: string
  is_active: boolean
}

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: VoucherFormLabels
  initial: VoucherFormValues
}

const numberInput = { type: 'text', inputMode: 'numeric', autoComplete: 'off' } as const

export function VoucherForm({ action, messages, labels, initial }: Props) {
  const { state, formProps, pending, formError, quietError, fieldError } = useFormAction(action, messages)

  return (
    <form {...formProps} noValidate className="grid max-w-2xl gap-5">
      {formError && <FormAlert quiet={quietError}>{formError}</FormAlert>}
      <TextField
        name="code"
        label={labels.code}
        defaultValue={initial.code}
        hint={labels.codeHint}
        maxLength={30}
        required
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="font-mono uppercase"
        error={fieldError('code')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="description"
          label={labels.description}
          defaultValue={initial.description}
          maxLength={300}
          error={fieldError('description')}
        />
        <TextField
          name="description_en"
          label={labels.descriptionEn}
          defaultValue={initial.description_en}
          hint={labels.descriptionEnHint}
          maxLength={300}
          lang="en"
          error={fieldError('description_en')}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="discount_type"
          label={labels.discountType}
          defaultValue={initial.discount_type}
          error={fieldError('discount_type')}
        >
          <option value="percent">{labels.types.percent}</option>
          <option value="fixed">{labels.types.fixed}</option>
        </SelectField>
        <TextField
          name="discount_value"
          label={labels.discountValue}
          defaultValue={initial.discount_value}
          hint={labels.discountValueHint}
          required
          error={fieldError('discount_value')}
          {...numberInput}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="max_discount"
          label={labels.maxDiscount}
          defaultValue={initial.max_discount}
          hint={labels.maxDiscountHint}
          error={fieldError('max_discount')}
          {...numberInput}
        />
        <TextField
          name="min_order_value"
          label={labels.minOrder}
          defaultValue={initial.min_order_value}
          hint={labels.minOrderHint}
          error={fieldError('min_order_value')}
          {...numberInput}
        />
      </div>
      <TextField
        name="usage_limit"
        label={labels.usageLimit}
        defaultValue={initial.usage_limit}
        hint={labels.usageLimitHint}
        error={fieldError('usage_limit')}
        {...numberInput}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="starts_at"
          type="datetime-local"
          label={labels.startsAt}
          defaultValue={initial.starts_at}
          hint={labels.periodHint}
          error={fieldError('starts_at')}
        />
        <TextField
          name="ends_at"
          type="datetime-local"
          label={labels.endsAt}
          defaultValue={initial.ends_at}
          hint={labels.periodHint}
          error={fieldError('ends_at')}
        />
      </div>
      <CheckboxField name="is_active" label={labels.active} hint={labels.activeHint} defaultChecked={initial.is_active} />
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pending={pending} pendingLabel={labels.pending} size="lg" className="h-11 px-5">
          {labels.submit}
        </SubmitButton>
        <AdminLink href="/admin/voucher" className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'h-11 px-5' })}>
          {labels.cancel}
        </AdminLink>
        <p role="status" className="text-sm text-success">
          {state?.ok && !pending ? labels.saved : ''}
        </p>
      </div>
    </form>
  )
}
