'use client'

import { useEffect, useRef, useState } from 'react'
import { FormAlert, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'
import type { CoverFormLabels } from '../form-props'

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: CoverFormLabels
  /** COVER_MAX_BYTES: kiểm tra trước ở client để không gửi file quá giới hạn body của Server Action */
  maxBytes: number
}

/** Upload bìa. Không JS: React tự đặt form multipart gửi thẳng Server Action, server kiểm tra cỡ / loại như nhau. */
export function CoverForm({ action, messages, labels, maxBytes }: Props) {
  const { state, formProps, pending, formError, quietError, fieldError } = useFormAction(action, messages)
  const [tooLarge, setTooLarge] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const uploaded = state?.ok === true && !pending

  // Upload xong: bỏ file đã chọn (useFormAction không reset form) để không gửi lại cùng ảnh
  useEffect(() => {
    if (uploaded) formRef.current?.reset()
  }, [uploaded])

  return (
    <form
      ref={formRef}
      {...formProps}
      onSubmit={(event) => {
        if (tooLarge) {
          event.preventDefault()
          return
        }
        formProps.onSubmit(event)
      }}
      noValidate
      className="grid gap-4"
    >
      {formError && !tooLarge && <FormAlert quiet={quietError}>{formError}</FormAlert>}
      <TextField
        name="cover"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        label={labels.file}
        hint={labels.hint}
        required
        onChange={(event) => setTooLarge((event.target.files?.[0]?.size ?? 0) > maxBytes)}
        className="h-auto py-2 file:mr-3 file:rounded-sm file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:text-foreground"
        error={tooLarge ? messages.validation.coverTooLarge : fieldError('cover')}
      />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={pending} pendingLabel={labels.uploading} size="lg" className="h-11 px-5">
          {labels.upload}
        </SubmitButton>
        <p role="status" className="text-sm text-success">
          {uploaded ? labels.uploaded : ''}
        </p>
      </div>
    </form>
  )
}
