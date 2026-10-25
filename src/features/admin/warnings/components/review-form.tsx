'use client'

import type { ContentWarning } from '@/features/warnings/labels'
import { FormAlert } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'
import { WarningLabelsField, type WarningLabelOption } from './warning-labels-field'

export type ReviewFormLabels = { legend: string; approve: string; dismiss: string; saving: string }

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: ReviewFormLabels
  options: readonly WarningLabelOption[]
  /** Nhãn AI gợi ý (admin sửa trước khi duyệt) */
  suggested: readonly ContentWarning[]
  /**
   * content_warnings_reviewed_at của sách lúc mở trang, nguyên chuỗi PostgREST (không qua Date). null = sách chưa xét:
   * không có ô ẩn → action bỏ hẳn tham số p_expected_reviewed_at.
   */
  expectedReviewedAt: string | null
}

/** Một gợi ý chờ duyệt: sửa nhãn rồi Duyệt / Bỏ qua (nút bấm gửi `decision`) */
export function ReviewForm({ action, messages, labels, options, suggested, expectedReviewedAt }: Props) {
  const { formProps, pending, ready, formError, quietError, fieldError } = useFormAction(action, messages)
  return (
    <form {...formProps} className="grid gap-4">
      {formError && <FormAlert quiet={quietError}>{formError}</FormAlert>}
      <WarningLabelsField
        name="labels"
        legend={labels.legend}
        options={options}
        defaultValue={suggested}
        error={fieldError('labels')}
      />
      {expectedReviewedAt !== null && <input type="hidden" name="expected_reviewed_at" value={expectedReviewedAt} />}
      <div className="flex flex-wrap gap-3">
        <SubmitButton
          name="decision"
          value="approve"
          pending={pending}
          ready={ready}
          pendingLabel={labels.saving}
          size="lg"
          className="h-11 px-5"
        >
          {labels.approve}
        </SubmitButton>
        <SubmitButton
          name="decision"
          value="dismiss"
          pending={pending}
          ready={ready}
          pendingLabel={labels.saving}
          variant="outline"
          size="lg"
          className="h-11 px-5"
        >
          {labels.dismiss}
        </SubmitButton>
      </div>
    </form>
  )
}
