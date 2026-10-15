'use client'

import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { FormAlert } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  label: string
  pendingLabel: string
  variant?: ComponentProps<typeof Button>['variant']
}

/** Form chỉ có một nút (ẩn / hiện sách, xóa tác giả): lỗi hiện ngay trên nút, chạy được không cần JS */
export function ActionButtonForm({ action, messages, label, pendingLabel, variant = 'outline' }: Props) {
  const { formProps, pending, formError } = useFormAction(action, messages)
  return (
    <form {...formProps} className="grid justify-items-start gap-3">
      {formError && <FormAlert>{formError}</FormAlert>}
      <SubmitButton pending={pending} pendingLabel={pendingLabel} variant={variant} size="lg" className="h-11 px-5">
        {label}
      </SubmitButton>
    </form>
  )
}
