'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AdminLink } from '@/components/admin/admin-link'
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
  /** {seconds}: bấm lại ngay sau một lượt, chờ cho đủ khoảng cách */
  cooling: string
  /** {inserted} */
  totals: string
  done: string
  stopped: string
  /** Lượt không ghi được gợi ý nào: lô dừng */
  stalled: string
  /** Tiêu đề danh sách sách AI chưa trả lời */
  missing: string
}

type Props = {
  labels: BatchSuggestLabels
  messages: FormMessages
  /** Thời gian chờ từ lúc một lượt xong tới lượt sau (server tính từ WARNING_LIMITS.callsPerMinute) */
  intervalMs: number
  /** Không còn sách chưa xét nào chưa có gợi ý */
  disabled: boolean
}

type Phase = 'idle' | 'running' | 'waiting' | 'done' | 'stopped' | 'stalled' | 'failed'
type MissingBook = BatchOutcome['missing'][number]

const NETWORK_FAILURE: Result<BatchOutcome> = { ok: false, code: 'NETWORK_ERROR' }

/**
 * "Gợi ý cho sách chưa xét": gọi suggestNextBatch lần lượt (mỗi lần một lượt Gemini), lượt sau bắt đầu intervalMs sau khi
 * lượt trước xong (cả khi Dừng rồi bấm lại). Tính từ lúc xong, không từ lúc bắt đầu: server trừ warn:minute giữa lần gọi,
 * sau khoảng trễ mạng / truy vấn khác nhau mỗi lần; chờ từ lúc xong thì hai lần trừ luôn cách nhau ≥ intervalMs.
 * Dừng khi hết sách (remaining = false), khi một lượt không ghi được gợi ý nào (gọi tiếp sẽ lặp đúng nhóm sách đó), khi
 * gặp lỗi bất kỳ (hạn mức, AI lỗi, FORBIDDEN, mạng), khi bấm Dừng và khi rời trang (dọn timer lúc unmount). Lượt đang
 * chạy không hủy được (server đã trừ lượt): Dừng chỉ chặn lượt sau. Sách AI chưa trả lời hiện thành link sửa sách.
 */
export function BatchSuggest({ labels, messages, intervalMs, disabled }: Props) {
  const router = useRouter()
  const hydrated = useHydrated()
  const [phase, setPhase] = useState<Phase>('idle')
  const [round, setRound] = useState(0)
  const [inserted, setInserted] = useState(0)
  const [missing, setMissing] = useState<MissingBook[]>([])
  const [error, setError] = useState<string | null>(null)
  const [stopRequested, setStopRequested] = useState(false)
  // Ref: callback của setTimeout / lượt đang chờ đọc giá trị mới nhất, không theo closure của lần render cũ
  const active = useRef(false)
  const mounted = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastFinishedAt = useRef(0)
  const startButton = useRef<HTMLButtonElement>(null)
  const stopButton = useRef<HTMLButtonElement>(null)
  const busy = phase === 'running' || phase === 'waiting'

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current = false
      clearTimeout(timer.current)
    }
  }, [])

  // Nút đang focus bị khóa (Bắt đầu khi chạy, Dừng khi lô xong) → chuyển focus sang nút còn dùng được, không rơi về body.
  // Chỉ khi busy đổi (không kéo focus lúc mở trang)
  const wasBusy = useRef(false)
  useEffect(() => {
    if (busy === wasBusy.current) return
    wasBusy.current = busy
    const target = busy ? stopButton.current : startButton.current
    const focused = document.activeElement
    if (focused === startButton.current || focused === stopButton.current || focused === document.body) target?.focus()
  }, [busy])

  function schedule(n: number, delay: number) {
    setPhase('waiting')
    setRound(n - 1)
    timer.current = setTimeout(() => {
      if (active.current) void runRound(n)
    }, delay)
  }

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
    lastFinishedAt.current = Date.now()
    if (!mounted.current) return
    // Lỗi giữa chừng có thể đã ghi một phần gợi ý: luôn làm mới danh sách + số đếm
    router.refresh()

    if (!result.ok) {
      active.current = false
      setError(result.message ?? messages.errors[result.code] ?? messages.errors.UNKNOWN)
      setPhase('failed')
      return
    }
    const outcome = result.data
    const newIds = new Set(outcome.missing.map((book) => book.id))
    setInserted((count) => count + outcome.inserted)
    setMissing((books) => [...books.filter((book) => !newIds.has(book.id)), ...outcome.missing])
    if (!outcome.remaining) {
      active.current = false
      setPhase('done')
    } else if (outcome.inserted === 0) {
      active.current = false
      setPhase('stalled')
    } else if (!active.current) {
      setPhase('stopped')
    } else {
      schedule(n + 1, intervalMs)
    }
  }

  function start() {
    if (active.current) return
    active.current = true
    setStopRequested(false)
    setError(null)
    setInserted(0)
    setMissing([])
    const wait = intervalMs - (Date.now() - lastFinishedAt.current)
    if (wait > 0) schedule(1, wait)
    else void runRound(1)
  }

  function stop() {
    active.current = false
    clearTimeout(timer.current)
    setStopRequested(true)
    // Đang chờ lượt sau: dừng ngay. Đang gọi: runRound tự chuyển sang 'stopped' khi lượt này xong
    if (phase === 'waiting') setPhase('stopped')
  }

  const seconds = Math.ceil(intervalMs / 1000)
  const status = {
    idle: '',
    running: fillTemplate(labels.running, { n: round }),
    waiting: round === 0 ? fillTemplate(labels.cooling, { seconds }) : fillTemplate(labels.waiting, { n: round, seconds }),
    done: labels.done,
    stopped: labels.stopped,
    stalled: labels.stalled,
    failed: '',
  }[phase]

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{labels.hint}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          ref={startButton}
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
          <Button
            ref={stopButton}
            type="button"
            variant="outline"
            size="lg"
            className="h-11 px-5"
            disabled={stopRequested}
            aria-disabled={stopRequested}
            onClick={stop}
          >
            {labels.stop}
          </Button>
        )}
      </div>
      <div role="status" className="grid gap-1 text-sm">
        {status && <p>{status}</p>}
        {phase !== 'idle' && <p className="text-muted-foreground">{fillTemplate(labels.totals, { inserted })}</p>}
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      {missing.length > 0 && !busy && (
        <div className="grid gap-1 text-sm">
          <p>{labels.missing}</p>
          <ul className="grid list-disc gap-1 pl-5">
            {missing.map((book) => (
              <li key={book.id}>
                <AdminLink href={`/admin/sach/${book.id}`} className="text-primary underline-offset-4 hover:underline">
                  {book.title}
                </AdminLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
