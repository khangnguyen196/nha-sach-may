'use client'

import { FormAlert } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'

type Props = {
  /** markPayoutPaid đã bind id khoản */
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  /** Còn bấm được (chờ trả, đơn đã giao + đã thanh toán); false → chỉ còn thông báo kết quả (nếu có) */
  payable: boolean
  labels: { button: string; buttonLabel: string; pending: string; done: string }
}

/**
 * Nút "Đã trả" của một khoản. Page luôn render ở cùng ô của dòng: action xong (hoặc PAYOUT_STATUS_CHANGED) thì
 * refresh() → server render lại với `payable = false`, component không bị gỡ nên câu kết quả vẫn còn tại dòng.
 */
export function MarkPayoutPaidForm({ action, messages, payable, labels }: Props) {
  const { state, formProps, pending, ready, formError } = useFormAction(action, messages)
  const feedback = (
    <>
      {formError && <FormAlert>{formError}</FormAlert>}
      {state?.ok && !pending && (
        <p role="status" className="text-sm font-medium text-success">
          {labels.done}
        </p>
      )}
    </>
  )
  if (!payable) return state ? <div className="grid max-w-64 gap-2">{feedback}</div> : null

  return (
    <form {...formProps} className="grid max-w-64 justify-items-start gap-2">
      {feedback}
      <SubmitButton
        pending={pending}
        ready={ready}
        pendingLabel={labels.pending}
        variant="outline"
        size="lg"
        className="h-9 px-3"
        aria-label={labels.buttonLabel}
      >
        {labels.button}
      </SubmitButton>
    </form>
  )
}
