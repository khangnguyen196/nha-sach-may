'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FormAlert } from '@/components/ui/field'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { fillTemplate } from '@/lib/template'
import { useHydrated } from '@/lib/use-hydrated'
import { suggestNextBatch } from '../actions'
import type { BatchOutcome } from '../schemas'

export type BatchSuggestLabels = {
  start: string
  starting: string
  stop: string
  hint: string
  /** {n} */
  running: string
  /** {n}, {seconds} */
  waiting: string
  /** {inserted}, {missing} */
  totals: string
  done: string
  stopped: string
}

type Props = {
  labels: BatchSuggestLabels
  messages: FormMessages
  /** Thời gian chờ từ lúc một lượt xong tới lượt sau (server tính từ WARNING_LIMITS.callsPerMinute) */
  intervalMs: number
  /** Không còn sách chưa xét nào chưa có gợi ý */
  disabled: boolean
}

type Phase = 'idle' | 'running' | 'waiting' | 'done' | 'stopped' | 'failed'

const NETWORK_FAILURE: Result<BatchOutcome> = { ok: false, code: 'NETWORK_ERROR' }

/**
 * "Gợi ý cho sách chưa xét": gọi suggestNextBatch lần lượt (mỗi lần một lượt Gemini), lượt sau bắt đầu intervalMs sau khi
 * lượt trước xong. Tính từ lúc xong, không từ lúc bắt đầu: server trừ warn:minute giữa lần gọi, sau khoảng trễ mạng /
 * truy vấn khác nhau mỗi lần; chờ từ lúc xong thì hai lần trừ luôn cách nhau ≥ intervalMs (không bao giờ 3 lượt / phút).
 * Dừng khi hết sách (remaining = false), khi gặp lỗi bất kỳ (hạn mức, AI lỗi, FORBIDDEN, mạng), khi bấm Dừng và khi rời
 * trang (dọn timer lúc unmount). Lượt đang chạy không hủy được (server đã trừ lượt): Dừng chỉ chặn lượt sau.
 */
export function BatchSuggest({ labels, messages, intervalMs, disabled }: Props) {
  const router = useRouter()
  const hydrated = useHydrated()
  const [phase, setPhase] = useState<Phase>('idle')
  const [round, setRound] = useState(0)
  const [totals, setTotals] = useState({ inserted: 0, missing: 0 })
  const [error, setError] = useState<string | null>(null)
  const [stopRequested, setStopRequested] = useState(false)
  // Ref: callback của setTimeout / lượt đang chờ đọc giá trị mới nhất, không theo closure của lần render cũ
  const active = useRef(false)
  const mounted = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current = false
      clearTimeout(timer.current)
    }
  }, [])

  async function runRound(n: number) {
    setPhase('running')
    setRound(n)
    let result: Result<BatchOutcome>
    try {
      result = await suggestNextBatch()
    } catch (cause) {
      console.error('suggestNextBatch:', cause)
      result = NETWORK_FAILURE
    }
    if (!mounted.current) return

    if (!result.ok) {
      active.current = false
      setError(result.message ?? messages.errors[result.code] ?? messages.errors.UNKNOWN)
      setPhase('failed')
      return
    }
    const { inserted, missing, remaining } = result.data
    setTotals((current) => ({ inserted: current.inserted + inserted, missing: current.missing + missing }))
    router.refresh()
    if (!remaining) {
      active.current = false
      setPhase('done')
      return
    }
    if (!active.current) {
      setPhase('stopped')
      return
    }
    setPhase('waiting')
    timer.current = setTimeout(() => {
      if (active.current) void runRound(n + 1)
    }, intervalMs)
  }

  function start() {
    if (active.current) return
    active.current = true
    setStopRequested(false)
    setError(null)
    setTotals({ inserted: 0, missing: 0 })
    void runRound(1)
  }

  function stop() {
    active.current = false
    clearTimeout(timer.current)
    setStopRequested(true)
    // Đang chờ lượt sau: dừng ngay. Đang gọi: runRound tự chuyển sang 'stopped' khi lượt này xong
    if (phase === 'waiting') setPhase('stopped')
  }

  const busy = phase === 'running' || phase === 'waiting'
  const seconds = Math.ceil(intervalMs / 1000)
  const status =
    phase === 'running'
      ? fillTemplate(labels.running, { n: round })
      : phase === 'waiting'
        ? fillTemplate(labels.waiting, { n: round, seconds })
        : phase === 'done'
          ? labels.done
          : phase === 'stopped'
            ? labels.stopped
            : ''

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{labels.hint}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="lg"
          className="h-11 px-5"
          disabled={!hydrated || busy || disabled}
          aria-disabled={!hydrated || busy || disabled}
          onClick={start}
        >
          {busy ? labels.starting : labels.start}
        </Button>
        {busy && (
          <Button type="button" variant="outline" size="lg" className="h-11 px-5" disabled={stopRequested} onClick={stop}>
            {labels.stop}
          </Button>
        )}
      </div>
      <div role="status" className="grid gap-1 text-sm">
        {status && <p>{status}</p>}
        {phase !== 'idle' && <p className="text-muted-foreground">{fillTemplate(labels.totals, totals)}</p>}
      </div>
      {error && <FormAlert>{error}</FormAlert>}
    </div>
  )
}
