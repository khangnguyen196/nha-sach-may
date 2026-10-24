'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { FormAlert, TextAreaField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { fillTemplate } from '@/lib/template'
import { useFormAction } from '@/lib/use-form-action'
import type { ListingStatus } from '@/features/used/status'

type FormAction = (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>

export type ListingReviewLabels = {
  approve: string
  approving: string
  approved: string
  reasonLabel: string
  reasonHint: string
  /** `{count}` điền ở client */
  reasonCount: string
  reject: string
  rejecting: string
  rejected: string
  takedown: string
  takedownHint: string
  takedownQuestion: string
  takedownConfirm: string
  takedownCancel: string
  takingDown: string
  takenDown: string
  readOnly: Record<'rejected' | 'sold' | 'withdrawn', string>
}

type Props = {
  /** Trạng thái đang hiển thị: gửi theo ô ẩn `expected_status` (RPC so với trạng thái thật) */
  status: ListingStatus
  /** approveListing / rejectListing đã bind id tin */
  approveAction: FormAction
  rejectAction: FormAction
  messages: FormMessages
  labels: ListingReviewLabels
  reasonMax: number
}

type Kind = 'approve' | 'reject' | 'takedown'

/**
 * Duyệt / từ chối (tin chờ duyệt), gỡ tin (tin đang bán, hỏi lại tại chỗ); trạng thái khác chỉ xem. Page luôn render
 * khối này ở cùng vị trí: action xong (hoặc LISTING_STATUS_CHANGED) thì refresh() → trang render lại với trạng thái mới,
 * khối không bị gỡ nên câu kết quả của lần gửi gần nhất vẫn còn (kể cả khi form vừa gửi đã biến mất).
 * Focus (WCAG 2.4.3): mở câu hỏi gỡ tin → "Không gỡ"; "Không gỡ" → lại "Gỡ tin"; trạng thái đổi sau khi gửi (form vừa
 * gửi bị gỡ) → khối kết quả.
 */
export function ListingReviewPanel({ status, approveAction, rejectAction, messages, labels, reasonMax }: Props) {
  const approveForm = useFormAction(approveAction, messages)
  const rejectForm = useFormAction(rejectAction, messages)
  const takedownForm = useFormAction(rejectAction, messages)
  const [last, setLast] = useState<Kind | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [reasonLength, setReasonLength] = useState(0)
  const feedback = useRef<HTMLDivElement>(null)
  const openTakedown = useRef<HTMLButtonElement>(null)
  const cancelTakedown = useRef<HTMLButtonElement>(null)
  /** Đổi giữa nút "Gỡ tin" và câu hỏi lại do người dùng bấm (không focus lúc mới render trang) */
  const moveFocus = useRef(false)
  const submitted = useRef(false)

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    ;(confirming ? cancelTakedown : openTakedown).current?.focus()
  }, [confirming])

  // Trạng thái đổi sau một lần gửi (duyệt / từ chối / gỡ xong, hay vừa đổi ở nơi khác): form vừa gửi đã bị gỡ khỏi trang
  useEffect(() => {
    if (submitted.current) feedback.current?.focus()
  }, [status])

  const forms = { approve: approveForm, reject: rejectForm, takedown: takedownForm }
  const done = { approve: labels.approved, reject: labels.rejected, takedown: labels.takenDown }
  const current = last ? forms[last] : null

  function submitWith(kind: Kind) {
    return (event: FormEvent<HTMLFormElement>) => {
      setLast(kind)
      submitted.current = true
      forms[kind].formProps.onSubmit(event)
    }
  }

  function toggleTakedown(next: boolean) {
    moveFocus.current = true
    setConfirming(next)
  }

  const reasonCounter = (
    <span className="text-xs text-subtle tabular-nums">{fillTemplate(labels.reasonCount, { count: reasonLength })}</span>
  )
  const expected = <input type="hidden" name="expected_status" value={status} />

  return (
    <div className="grid gap-5" data-testid="listing-review">
      <div ref={feedback} tabIndex={-1} className="grid gap-3 outline-none empty:hidden" data-testid="listing-review-feedback">
        {current?.formError && <FormAlert quiet={current.quietError}>{current.formError}</FormAlert>}
        {last && current?.state?.ok && !current.pending && (
          <p role="status" className="text-sm font-medium text-success">
            {done[last]}
          </p>
        )}
      </div>

      {status === 'pending' && (
        <>
          <form {...approveForm.formProps} onSubmit={submitWith('approve')} className="grid justify-items-start gap-3">
            {expected}
            <SubmitButton
              pending={approveForm.pending}
              ready={approveForm.ready}
              pendingLabel={labels.approving}
              size="lg"
              className="h-11 px-5"
            >
              {labels.approve}
            </SubmitButton>
          </form>
          <form {...rejectForm.formProps} onSubmit={submitWith('reject')} noValidate className="grid gap-3 border-t pt-5">
            {expected}
            <TextAreaField
              name="reason"
              idPrefix="reject"
              label={labels.reasonLabel}
              hint={labels.reasonHint}
              labelAside={reasonCounter}
              maxLength={reasonMax}
              rows={3}
              onChange={(event) => setReasonLength(event.target.value.length)}
              error={rejectForm.fieldError('reason')}
            />
            <SubmitButton
              variant="destructive"
              pending={rejectForm.pending}
              ready={rejectForm.ready}
              pendingLabel={labels.rejecting}
              size="lg"
              className="h-11 w-fit px-5"
            >
              {labels.reject}
            </SubmitButton>
          </form>
        </>
      )}

      {status === 'approved' && (
        <form {...takedownForm.formProps} onSubmit={submitWith('takedown')} noValidate className="grid gap-3">
          {expected}
          <p className="text-sm text-muted-foreground">{labels.takedownHint}</p>
          <TextAreaField
            name="reason"
            idPrefix="takedown"
            label={labels.reasonLabel}
            hint={labels.reasonHint}
            labelAside={reasonCounter}
            maxLength={reasonMax}
            rows={3}
            onChange={(event) => setReasonLength(event.target.value.length)}
            error={takedownForm.fieldError('reason')}
          />
          {confirming ? (
            <div className="grid gap-2 rounded-md border bg-surface-raised p-3" data-testid="takedown-confirm">
              <p className="text-sm">{labels.takedownQuestion}</p>
              <div className="flex flex-wrap gap-2">
                <SubmitButton
                  variant="destructive"
                  pending={takedownForm.pending}
                  ready={takedownForm.ready}
                  pendingLabel={labels.takingDown}
                  size="sm"
                  className="h-9 px-3"
                >
                  {labels.takedownConfirm}
                </SubmitButton>
                <Button
                  ref={cancelTakedown}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3"
                  disabled={takedownForm.pending}
                  onClick={() => toggleTakedown(false)}
                >
                  {labels.takedownCancel}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              ref={openTakedown}
              type="button"
              variant="outline"
              size="lg"
              className="h-11 w-fit px-5 text-destructive"
              disabled={!takedownForm.ready}
              onClick={() => toggleTakedown(true)}
            >
              {labels.takedown}
            </Button>
          )}
        </form>
      )}

      {(status === 'rejected' || status === 'sold' || status === 'withdrawn') && (
        <p className="text-sm text-muted-foreground" data-testid="listing-review-readonly">
          {labels.readOnly[status]}
        </p>
      )}
    </div>
  )
}
