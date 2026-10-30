'use client'

import { BookIcon, SendHorizontalIcon, XIcon } from 'lucide-react'
import Image from 'next/image'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type RefObject } from 'react'
import { cn } from 'cn'
import { Link } from '@/i18n/navigation'
import { fillTemplate } from '@/lib/template'
import { askMay, type ChatBookCard, type ChatReply } from '../actions'
import { CHAT_INPUT } from '../config'
import { checkMessage } from '../input'
import type { ChatBrowseCategory, ChatLabels } from '../labels'
import { recentTurns, visibleSuggestion, type ChatEntry } from './chat-state'
import { appendEntry, type NewChatEntry } from './entry-id'

// Khung chat, tải lười từ chat-bubble.tsx. ≥ 640px: khung nổi 360px, dialog KHÔNG modal (vẫn đọc trang được);
// < 640px: tấm toàn màn hình, modal (khóa cuộn nền, giữ focus). Chỉ render chữ thuần (React tự escape), không HTML /
// markdown / link do AI viết; link duy nhất là thẻ sách dựng từ DB và các link cố định khi lỗi.

const DESKTOP_QUERY = '(min-width: 640px)'

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const useDesktop = () =>
  useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_QUERY).matches, () => false)

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  labels: ChatLabels
  categories: ChatBrowseCategory[]
  /** Slug cuốn đang xem; chỉ slug đi lên server, server tự tra thông tin sách */
  slug: string | null
  entries: ChatEntry[]
  setEntries: (update: (entries: ChatEntry[]) => ChatEntry[]) => void
  ageConfirmed: boolean
  onConfirmAge: () => void
  returnFocus: RefObject<HTMLButtonElement | null>
}

export default function ChatPanel({
  open,
  onOpenChange,
  labels,
  categories,
  slug,
  entries,
  setEntries,
  ageConfirmed,
  onConfirmAge,
  returnFocus,
}: Props) {
  const desktop = useDesktop()
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const input = useRef<HTMLTextAreaElement>(null)
  const confirm = useRef<HTMLButtonElement>(null)
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [entries, pending])

  function send(raw: string) {
    const check = checkMessage(raw)
    if (!check.ok || pending || !ageConfirmed) return
    const history = recentTurns(entries)
    setEntries((current) => appendEntry(current, { role: 'user', text: check.message }))
    setDraft('')
    startTransition(async () => {
      let entry: NewChatEntry
      try {
        const result = await askMay({ message: check.message, history, slug, ageConfirmed: true })
        entry = result.ok
          ? { role: 'assistant', reply: result.data }
          : { role: 'error', code: result.code, details: result.details }
      } catch {
        // Không tới được server (mất mạng…): báo trong khung, không lên error boundary; trả câu hỏi lại ô nhập để gửi
        // lại (trừ khi khách đã gõ câu khác trong lúc chờ)
        entry = { role: 'error', code: 'NETWORK_ERROR' }
        setDraft((current) => current || check.message)
      }
      // id tính theo danh sách lúc thêm, không theo bộ đếm của khung (khung mount lại thì bộ đếm khởi lại)
      setEntries((current) => appendEntry(current, entry))
    })
  }

  const latestBook = [...entries].reverse().find((entry) => entry.role === 'assistant')
  const aboutBook = slug && latestBook?.role === 'assistant' ? latestBook.reply.aboutBook : null
  const chips = slug ? labels.bookChips : labels.chips
  // Gợi ý (chip ban đầu / follow_up) chỉ ở lượt mới nhất của Mây, khi khách chưa trả lời (chat-state.ts)
  const suggestion = visibleSuggestion(entries, pending)
  const closeOnMobile = () => {
    if (!desktop) onOpenChange(false)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={!desktop}>
      <DialogPrimitive.Portal>
        {/* Radix gắn khóa cuộn nền (RemoveScroll) vào Overlay: tấm modal trên mobile phải có Overlay */}
        {!desktop && <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background" />}
        <DialogPrimitive.Content
          data-testid="chat-panel"
          aria-describedby="chat-subtitle"
          // Khung nổi không modal: bấm ra ngoài (đọc trang, bấm bong bóng) không đóng khung
          onInteractOutside={(event) => {
            if (desktop) event.preventDefault()
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            const target = ageConfirmed ? input.current : confirm.current
            target?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus.current?.focus()
          }}
          className={cn(
            'z-50 flex flex-col bg-surface text-sm text-foreground outline-none',
            desktop
              ? 'fixed right-4 bottom-20 h-[min(36rem,calc(100dvh-7rem))] w-[22.5rem] rounded-xl border'
              : 'fixed inset-0 h-dvh pt-[env(safe-area-inset-top)]',
          )}
        >
          <header className="flex items-center gap-3 border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-serif text-lg font-semibold">{labels.title}</DialogPrimitive.Title>
              <DialogPrimitive.Description id="chat-subtitle" className="text-xs text-muted-foreground">
                {aboutBook ? fillTemplate(labels.aboutBook, { title: aboutBook }) : labels.subtitle}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className={cn(
                'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-muted-foreground',
                'transition-colors outline-none hover:bg-surface-raised hover:text-foreground focus-visible:ring-3 focus-visible:ring-focus-ring',
              )}
            >
              <XIcon aria-hidden className="size-5" />
              <span className={desktop ? 'sr-only' : ''}>{labels.close}</span>
            </DialogPrimitive.Close>
          </header>

          <div ref={log} role="log" aria-live="polite" aria-relevant="additions" className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {!ageConfirmed && (
              <section id="chat-gate" aria-labelledby="chat-gate-title" className="rounded-lg border bg-surface-raised p-4">
                <h3 id="chat-gate-title" className="font-medium">
                  {labels.gate.title}
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {labels.gate.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <button
                  ref={confirm}
                  type="button"
                  onClick={() => {
                    onConfirmAge()
                    requestAnimationFrame(() => input.current?.focus())
                  }}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-center font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-focus-ring"
                >
                  {labels.gate.confirm}
                </button>
              </section>
            )}

            <p className="text-muted-foreground">{slug ? labels.greetingBook : labels.greeting}</p>
            {suggestion.kind === 'chips' && (
              <ul className="flex flex-wrap gap-2" aria-label={labels.chipsLabel}>
                {chips.map((chip) => (
                  <li key={chip}>
                    <button
                      type="button"
                      disabled={!ageConfirmed || pending}
                      aria-describedby={ageConfirmed ? undefined : 'chat-gate'}
                      onClick={() => send(chip)}
                      className="rounded-full border px-3 py-1.5 text-left transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-focus-ring disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {entries.map((entry) =>
              entry.role === 'user' ? (
                <p key={entry.id} className="ml-8 rounded-lg bg-surface-raised px-3 py-2 whitespace-pre-line">
                  <span className="sr-only">{labels.you}: </span>
                  {entry.text}
                </p>
              ) : entry.role === 'assistant' ? (
                <Reply
                  key={entry.id}
                  reply={entry.reply}
                  labels={labels}
                  showFollowUp={suggestion.kind === 'followUp' && suggestion.entryId === entry.id}
                  onNavigate={closeOnMobile}
                />
              ) : (
                <ErrorBlock key={entry.id} entry={entry} labels={labels} categories={categories} onNavigate={closeOnMobile} />
              ),
            )}
            {pending && (
              <p role="status" className="text-muted-foreground">
                {labels.sending}
              </p>
            )}
          </div>

          <form
            className="border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onSubmit={(event) => {
              event.preventDefault()
              send(draft)
            }}
          >
            <p className="mb-2 text-xs text-subtle">{labels.disclaimer}</p>
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor="chat-input">
                {labels.inputLabel}
              </label>
              <textarea
                ref={input}
                id="chat-input"
                rows={2}
                maxLength={CHAT_INPUT.maxChars}
                value={draft}
                disabled={!ageConfirmed}
                aria-describedby={ageConfirmed ? 'chat-counter' : 'chat-gate'}
                placeholder={labels.placeholder}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    send(draft)
                  }
                }}
                // ≥ 16px trên mobile: iOS Safari tự phóng to khi chạm vào ô nhập chữ nhỏ hơn 16px
                className="min-h-11 flex-1 resize-none rounded-md border border-input bg-surface-raised px-3 py-2 text-base outline-none placeholder:text-subtle focus-visible:ring-3 focus-visible:ring-focus-ring disabled:opacity-50 sm:text-sm"
              />
              <button
                type="submit"
                aria-label={labels.send}
                disabled={!ageConfirmed || pending || !checkMessage(draft).ok}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-focus-ring disabled:opacity-50"
              >
                <SendHorizontalIcon aria-hidden className="size-5" />
              </button>
            </div>
            <p id="chat-counter" className="mt-1 text-right text-xs text-subtle">
              {fillTemplate(labels.counter, { count: draft.length })}
            </p>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Reply({
  reply,
  labels,
  showFollowUp,
  onNavigate,
}: {
  reply: ChatReply
  labels: ChatLabels
  showFollowUp: boolean
  onNavigate: () => void
}) {
  return (
    <div className="space-y-3" data-testid="chat-reply">
      <p className="whitespace-pre-line">{reply.message}</p>
      {reply.languageNotice && <p className="text-muted-foreground">{labels.languageNotice}</p>}
      {reply.books.length > 0 && (
        <ul className="space-y-2" aria-label={labels.suggestions}>
          {reply.books.map((book) => (
            <li key={book.slug}>
              <BookCard book={book} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
      {showFollowUp && reply.followUp && (
        <p className="text-muted-foreground" data-testid="chat-follow-up">
          {reply.followUp}
        </p>
      )}
    </div>
  )
}

function BookCard({ book, onNavigate }: { book: ChatBookCard; onNavigate: () => void }) {
  return (
    <Link
      href={{ pathname: '/books/[slug]', params: { slug: book.slug } }}
      onClick={onNavigate}
      data-testid="chat-book-card"
      className="flex gap-3 rounded-lg border p-2 transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-focus-ring"
    >
      <span className="relative h-18 w-12 shrink-0 overflow-hidden rounded-cover bg-surface-raised">
        {book.coverUrl ? (
          // Tên sách hiện ngay cạnh trong cùng link → alt rỗng (CLAUDE.md → Accessibility)
          <Image src={book.coverUrl} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <BookIcon aria-hidden className="absolute inset-0 m-auto size-5 text-subtle" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 font-medium">{book.title}</span>
        {book.authors && <span className="block truncate text-xs text-muted-foreground">{book.authors}</span>}
        <span className="block text-xs font-medium text-primary">{book.priceLabel}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{book.reason}</span>
      </span>
    </Link>
  )
}

type ErrorEntry = Extract<ChatEntry, { role: 'error' }>

function errorText(entry: ErrorEntry, labels: ChatLabels): { vi: string; en?: string } {
  const scope = entry.details?.scope
  const time = entry.details?.resetTime
  switch (entry.code) {
    case 'CHAT_FREE_QUOTA':
      return scope === 'gemini_day' && time !== undefined
        ? { vi: fillTemplate(labels.errors.freeDay.vi, { time }), en: fillTemplate(labels.errors.freeDay.en, { time }) }
        : labels.errors.freeMinute
    case 'CHAT_QUOTA_EXCEEDED':
      if ((scope === 'visitor_hour' || scope === 'ip_hour') && time !== undefined) {
        return { vi: fillTemplate(labels.errors.visitorHour, { time }) }
      }
      return { vi: labels.errors.visitorDay }
    case 'CHAT_REGION':
      return { vi: labels.errors.region }
    case 'NETWORK_ERROR':
      return { vi: labels.errors.network }
    default:
      return { vi: labels.errors.tired }
  }
}

function ErrorBlock({
  entry,
  labels,
  categories,
  onNavigate,
}: {
  entry: ErrorEntry
  labels: ChatLabels
  categories: ChatBrowseCategory[]
  onNavigate: () => void
}) {
  const text = errorText(entry, labels)
  const linkClass =
    'inline-flex min-h-9 items-center rounded-full border px-3 transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-focus-ring'
  return (
    <div className="space-y-2 rounded-lg border bg-surface-raised p-3" data-testid="chat-error" data-code={entry.code}>
      <p>{text.vi}</p>
      {text.en && (
        <p lang="en" className="text-muted-foreground">
          {text.en}
        </p>
      )}
      <ul className="flex flex-wrap gap-2 pt-1">
        <li>
          <Link href="/search" onClick={onNavigate} className={cn(linkClass, 'font-medium text-primary')}>
            {labels.search}
          </Link>
        </li>
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={{ pathname: '/categories/[slug]', params: { slug: category.slug } }}
              onClick={onNavigate}
              aria-label={`${labels.browse}: ${category.name}`}
              className={linkClass}
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
