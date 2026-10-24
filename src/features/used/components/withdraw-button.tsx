'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import type { Result } from '@/lib/errors'
import { useHydrated } from '@/lib/use-hydrated'

type Props = {
  action: () => Promise<Result<null>>
  labels: { button: string; question: string; confirm: string; cancel: string; pending: string }
  /** Câu lỗi đã dịch theo mã (LISTING_NOT_EDITABLE, AUTH_REQUIRED…), UNKNOWN / NETWORK_ERROR luôn có */
  errors: Partial<Record<string, string>> & { UNKNOWN: string; NETWORK_ERROR: string }
  /** id phần tử ổn định của mục tin (tabIndex={-1}): nhận focus sau khi rút xong, khi nút này bị gỡ khỏi trang */
  focusAfterWithdrawId: string
}

/**
 * Rút tin: bấm "Rút tin" → hỏi lại ngay tại chỗ → gọi Server Action (ngoài form: tự bắt lỗi mạng). Thành công: action
 * refresh() → danh sách render lại với nhãn "Đã rút" (nút này biến mất). Nút khóa tới khi hydrate.
 * Focus (WCAG 2.4.3): mở câu hỏi → "Không rút"; "Không rút" → lại "Rút tin"; rút xong → phần tử `focusAfterWithdrawId`
 * của mục tin (không rơi về body khi nút bị gỡ).
 */
export function WithdrawButton({ action, labels, errors, focusAfterWithdrawId }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const hydrated = useHydrated()
  const openButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  /** Đổi giữa nút "Rút tin" và khối hỏi lại do người dùng bấm (không focus lúc mới render trang) */
  const moveFocus = useRef(false)
  const withdrawn = useRef(false)

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    ;(confirming ? cancelButton : openButton).current?.focus()
  }, [confirming])

  // Rút xong: refresh() render lại mục tin không còn nút này → focus phần tử ổn định của mục (đã mang nhãn "Đã rút")
  useEffect(
    () => () => {
      if (withdrawn.current) document.getElementById(focusAfterWithdrawId)?.focus()
    },
    [focusAfterWithdrawId],
  )

  function toggle(next: boolean) {
    moveFocus.current = true
    setConfirming(next)
  }

  function withdraw() {
    setError(null)
    startTransition(async () => {
      let result: Result<null>
      try {
        result = await action()
      } catch {
        result = { ok: false, code: 'NETWORK_ERROR' }
      }
      if (result.ok) withdrawn.current = true
      else setError(errors[result.code] ?? errors.UNKNOWN)
    })
  }

  if (!confirming) {
    return (
      <Button
        ref={openButton}
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-3"
        disabled={!hydrated}
        onClick={() => toggle(true)}
      >
        {labels.button}
      </Button>
    )
  }

  return (
    <div className="grid w-full gap-2 rounded-md border bg-surface-raised p-3" data-testid="withdraw-confirm">
      <p className="text-sm">{labels.question}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" size="sm" className="h-9 px-3" disabled={pending} onClick={withdraw}>
          {pending ? labels.pending : labels.confirm}
        </Button>
        <Button
          ref={cancelButton}
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-3"
          disabled={pending}
          onClick={() => toggle(false)}
        >
          {labels.cancel}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
