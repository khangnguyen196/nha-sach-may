'use client'

import { FormAlert } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'

type Props = {
  /** advanceOrder đã bind id + trạng thái đang hiển thị */
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  /** Nhãn nút theo bước kế tiếp; null = trạng thái cuối, không còn nút */
  label: string | null
  pendingLabel: string
  doneLabel: string
}

/**
 * Nút chuyển bước kế tiếp. Page luôn render component này ở cùng vị trí, kể cả khi đơn đã tới trạng thái cuối: action
 * xong (hoặc gặp ORDER_STATUS_CHANGED vì khách vừa tự hủy) thì refresh() → server render lại với `label = null`,
 * component không bị gỡ nên thông báo kết quả vẫn còn.
 */
export function AdvanceOrderForm({ action, messages, label, pendingLabel, doneLabel }: Props) {
  const { state, formProps, pending, ready, formError } = useFormAction(action, messages)
  const feedback = (
    <>
      {formError && <FormAlert>{formError}</FormAlert>}
      {state?.ok && !pending && (
        <p role="status" className="text-sm font-medium text-success">
          {doneLabel}
        </p>
      )}
    </>
  )
  if (!label) return state ? <div className="grid gap-3">{feedback}</div> : null

  return (
    <form {...formProps} className="grid justify-items-start gap-3">
      {feedback}
      <SubmitButton pending={pending} ready={ready} pendingLabel={pendingLabel} size="lg" className="h-11 px-5">
        {label}
      </SubmitButton>
    </form>
  )
}
