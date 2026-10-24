'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import type { Result } from '@/lib/errors'
import { useHydrated } from '@/lib/use-hydrated'

type Props = {
  action: () => Promise<Result<null>>
  labels: { button: string; question: string; confirm: string; cancel: string; pending: string }
  /** Câu lỗi đã dịch theo mã (LISTING_NOT_EDITABLE, AUTH_REQUIRED…), UNKNOWN / NETWORK_ERROR luôn có */
  errors: Partial<Record<string, string>> & { UNKNOWN: string; NETWORK_ERROR: string }
}

/**
 * Rút tin: bấm "Rút tin" → hỏi lại ngay tại chỗ → gọi Server Action (ngoài form: tự bắt lỗi mạng). Thành công: action
 * refresh() → danh sách render lại với nhãn "Đã rút" (nút này biến mất). Nút khóa tới khi hydrate.
 */
export function WithdrawButton({ action, labels, errors }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const hydrated = useHydrated()

  function withdraw() {
    setError(null)
    startTransition(async () => {
      let result: Result<null>
      try {
        result = await action()
      } catch {
        result = { ok: false, code: 'NETWORK_ERROR' }
      }
      if (!result.ok) setError(errors[result.code] ?? errors.UNKNOWN)
    })
  }

  if (!confirming) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-9 px-3" disabled={!hydrated} onClick={() => setConfirming(true)}>
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
        <Button type="button" variant="ghost" size="sm" className="h-9 px-3" disabled={pending} onClick={() => setConfirming(false)}>
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
