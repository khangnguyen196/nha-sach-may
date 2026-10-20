'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { fillTemplate } from '@/lib/template'
import { useFormAction } from '@/lib/use-form-action'

/**
 * Supabase giới hạn gửi lại mỗi email ~60 giây; action báo "đã gửi" cả khi bị giới hạn (không lộ email nào có tài khoản)
 * → khóa nút 60 giây cố định ở client để khách không bấm lần GoTrue âm thầm bỏ thư
 */
const COOLDOWN_SECONDS = 60

export type ResendLabels = { submit: string; pending: string; sent: string; wait: string }

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: ResendLabels
  /** Email khách vừa đăng nhập (signIn trả về kèm EMAIL_NOT_CONFIRMED) */
  email: string
}

/** Giây hiện tại, cập nhật mỗi giây khi `active` (đếm ngược) */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

/**
 * Nút "Gửi lại email xác nhận" dưới lỗi EMAIL_NOT_CONFIRMED ở trang đăng nhập. Form riêng (không lồng trong form đăng
 * nhập); khóa nút 60 giây sau khi gửi xong, đếm ngược trên nút. Chỉ hiện sau lỗi của form đăng nhập (đã có JS); nút
 * vẫn khóa tới khi hydrate như mọi form dùng useFormAction (docs/plans/no-js.md ★8).
 */
export function ResendConfirmation({ action, messages, labels, email }: Props) {
  const { state, formProps, pending, ready, formError } = useFormAction(action, messages)
  const [submittedAt, setSubmittedAt] = useState<number | null>(null)
  const sent = state?.ok === true
  const now = useNow(sent && submittedAt !== null)
  const elapsed = submittedAt === null ? COOLDOWN_SECONDS : Math.max(0, Math.floor((now - submittedAt) / 1000))
  const remaining = sent ? Math.max(0, COOLDOWN_SECONDS - elapsed) : 0

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmittedAt(Date.now())
    formProps.onSubmit(event)
  }

  return (
    <form action={formProps.action} onSubmit={onSubmit} className="grid gap-2" data-testid="resend-confirmation">
      <input type="hidden" name="email" value={email} />
      <SubmitButton
        variant="outline"
        size="lg"
        className="h-11 w-full"
        pending={pending}
        ready={ready}
        pendingLabel={labels.pending}
        disabled={remaining > 0}
      >
        {remaining > 0 ? fillTemplate(labels.wait, { seconds: remaining }) : labels.submit}
      </SubmitButton>
      <p role="status" className="text-sm text-success">
        {sent && !pending ? labels.sent : ''}
      </p>
      {formError && !pending && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
    </form>
  )
}
