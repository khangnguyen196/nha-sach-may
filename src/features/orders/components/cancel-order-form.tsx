'use client'

import { useEffect, useRef, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { FormAlert, TextAreaField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { fillTemplate } from '@/lib/template'
import { useFormAction } from '@/lib/use-form-action'
import { cn } from '@/lib/utils'

/** Chuỗi đã dịch từ server; `{count}` của reasonCount điền ở client */
export type CancelOrderLabels = {
  cancel: string
  cancelHint: string
  reasonLabel: string
  reasonHint: string
  reasonCount: string
  confirmCancel: string
  cancelling: string
  cancelDone: string
}

type Props = {
  /** cancelOrder đã bind locale, id, mã đơn */
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: CancelOrderLabels
  /** canCancel(order) ở server */
  cancellable: boolean
  reasonMax: number
}

/**
 * Khối hủy đơn. Xác nhận bằng <details> (không cần JS, bàn phím mở / đóng được, không thêm dialog vào bundle) như
 * xóa địa chỉ. Page luôn render component này ở cùng vị trí, kể cả khi đơn không còn hủy được: action hủy xong (hoặc
 * gặp ORDER_NOT_CANCELLABLE) thì refresh() → server render lại với `cancellable = false`, component không bị gỡ nên
 * thông báo kết quả trong state vẫn còn để hiện.
 */
export function CancelOrderForm({ action, messages, labels, cancellable, reasonMax }: Props) {
  const { state, formProps, pending, formError, fieldError } = useFormAction(action, messages)
  const [reasonLength, setReasonLength] = useState(0)
  const alertRef = useRef<HTMLDivElement>(null)

  const failure = state && !state.ok ? state : null
  const reasonError = fieldError('reason')
  // Lỗi lý do hiện tại ô; lỗi khác (không hủy được nữa, mạng) hiện ở khối lỗi
  const alert = reasonError ? undefined : (failure?.message ?? formError)

  // Focus vào khối lỗi để trình đọc màn hình đọc ngay
  useEffect(() => {
    if (failure) alertRef.current?.focus()
  }, [failure])

  const feedback = (
    <>
      {alert && (
        <div ref={alertRef} tabIndex={-1} className="outline-none" data-testid="cancel-error">
          <FormAlert>{alert}</FormAlert>
        </div>
      )}
      {state?.ok && (
        <p role="status" className="text-sm font-medium text-success" data-testid="cancel-done">
          {labels.cancelDone}
        </p>
      )}
    </>
  )

  if (!cancellable) return state ? <div className="mt-6">{feedback}</div> : null

  return (
    // Không JS: trang render lại sau khi gửi → mở sẵn khi có lỗi để thấy lỗi
    <details className="group mt-6 rounded-lg border bg-surface p-5" open={failure ? true : undefined}>
      <summary
        className={cn(
          buttonVariants({ variant: 'outline', size: 'lg', className: 'h-10 px-4' }),
          'cursor-pointer list-none text-destructive [&::-webkit-details-marker]:hidden',
        )}
      >
        {labels.cancel}
      </summary>
      <form {...formProps} className="mt-4 grid gap-4">
        <p className="text-sm text-muted-foreground">{labels.cancelHint}</p>
        <TextAreaField
          name="reason"
          label={labels.reasonLabel}
          hint={labels.reasonHint}
          labelAside={
            <span className="text-xs text-subtle tabular-nums">
              {fillTemplate(labels.reasonCount, { count: reasonLength })}
            </span>
          }
          maxLength={reasonMax}
          rows={3}
          onChange={(event) => setReasonLength(event.target.value.length)}
          error={reasonError}
        />
        {feedback}
        <SubmitButton
          variant="destructive"
          size="lg"
          className="h-10 w-fit px-4"
          pending={pending}
          pendingLabel={labels.cancelling}
        >
          {labels.confirmCancel}
        </SubmitButton>
      </form>
    </details>
  )
}
