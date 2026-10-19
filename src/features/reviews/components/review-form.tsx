'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SignInAgainLink } from '@/components/layout/sign-in-again-link'
import { FormAlert, TextAreaField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { fillTemplate } from '@/lib/template'
import { useFormAction } from '@/lib/use-form-action'

type Action = (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>

/** Chuỗi đã dịch từ server; `{count}` của contentCount điền ở client */
export type ReviewFormLabels = {
  ratingLabel: string
  /** 5 nhãn đọc được: "1 sao" … "5 sao" */
  ratingOptions: string[]
  contentLabel: string
  contentHint: string
  contentCount: string
  submit: string
  saving: string
  saved: string
  delete: string
  deleting: string
  deleted: string
}

type Props = {
  /** saveReview đã bind id sách */
  save: Action
  /** deleteReview đã bind id sách; null = chưa có đánh giá */
  remove: Action | null
  messages: FormMessages
  labels: ReviewFormLabels
  defaults: { rating: number | null; content: string | null }
  contentMax: number
  /** Tiền tố id ô nhập: trang đơn có một form / dòng sách */
  idPrefix?: string
  /** Icon do Server Component cha render (client leaf không import lucide, perf-js bước C) */
  starIcon: ReactNode
}

const noop: Action = async () => ({ ok: true, data: null })

/**
 * Viết / sửa / xóa đánh giá của mình. Radio sao gốc (không JS vẫn gửi được, bàn phím dùng mũi tên). Component giữ
 * nguyên vị trí khi server render lại sau refresh() nên thông báo kết quả còn; xóa xong thì reset ô nhập.
 */
export function ReviewForm({
  save,
  remove,
  messages,
  labels,
  defaults,
  contentMax,
  idPrefix = 'review',
  starIcon,
}: Props) {
  const saving = useFormAction(save, messages)
  const deleting = useFormAction(remove ?? noop, messages)
  const formRef = useRef<HTMLFormElement>(null)
  const [contentLength, setContentLength] = useState(defaults.content?.length ?? 0)
  const saved = saving.state?.ok === true && !saving.pending
  const deleted = deleting.state?.ok === true && !deleting.pending

  // Xóa xong: đưa ô nhập về trống (onReset cập nhật bộ đếm)
  useEffect(() => {
    if (deleted) formRef.current?.reset()
  }, [deleted])

  return (
    <div className="grid gap-4">
      <form
        ref={formRef}
        {...saving.formProps}
        onReset={() => setContentLength(0)}
        className="grid gap-5"
        data-testid="review-form"
      >
        <fieldset>
          <legend className="text-sm font-medium">{labels.ratingLabel}</legend>
          <div className="mt-2 flex gap-1">
            {labels.ratingOptions.map((label, index) => (
              <label
                key={label}
                className="group relative flex cursor-pointer flex-col items-center rounded-sm p-1 text-xs text-subtle transition-colors hover:text-primary has-checked:text-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50 [&_svg]:size-7 has-checked:[&_svg]:fill-primary"
              >
                <input
                  type="radio"
                  name="rating"
                  value={index + 1}
                  defaultChecked={defaults.rating === index + 1}
                  required
                  aria-label={label}
                  className="sr-only"
                />
                {starIcon}
                <span aria-hidden>{index + 1}</span>
              </label>
            ))}
          </div>
          {saving.fieldError('rating') && (
            <p className="mt-1.5 text-sm text-destructive">{saving.fieldError('rating')}</p>
          )}
        </fieldset>
        <TextAreaField
          name="content"
          idPrefix={idPrefix}
          label={labels.contentLabel}
          hint={labels.contentHint}
          labelAside={
            <span className="text-xs text-subtle tabular-nums">
              {fillTemplate(labels.contentCount, { count: contentLength })}
            </span>
          }
          defaultValue={defaults.content ?? ''}
          maxLength={contentMax}
          rows={4}
          onChange={(event) => setContentLength(event.target.value.length)}
          error={saving.fieldError('content')}
        />
        {saving.formError && !saving.quietError && (
          <FormAlert action={saving.signIn && <SignInAgainLink signIn={saving.signIn} />}>{saving.formError}</FormAlert>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton pending={saving.pending} pendingLabel={labels.saving} size="lg" className="h-11 px-5">
            {labels.submit}
          </SubmitButton>
          <p role="status" className="text-sm text-success">
            {saved ? labels.saved : null}
          </p>
        </div>
      </form>
      {remove && (
        <form {...deleting.formProps} className="grid justify-items-start gap-3">
          {deleting.formError && (
            <FormAlert action={deleting.signIn && <SignInAgainLink signIn={deleting.signIn} />}>{deleting.formError}</FormAlert>
          )}
          <SubmitButton pending={deleting.pending} pendingLabel={labels.deleting} variant="outline" className="h-9">
            {labels.delete}
          </SubmitButton>
        </form>
      )}
      {deleted && !remove && (
        <p role="status" className="text-sm text-success">
          {labels.deleted}
        </p>
      )}
    </div>
  )
}
