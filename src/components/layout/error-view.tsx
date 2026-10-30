'use client'

import { createContext, Fragment, use, useEffect, useRef, type ReactNode } from 'react'
import { SUPPORT_EMAIL } from '@/lib/support'

/**
 * Chuỗi của trang lỗi, đã dịch (namespace `errorPage`). Giữ nguyên chỗ trống `{email}`, `{digest}` (điền ở đây):
 * global-error dùng bản chép của messages/*.json, không qua next-intl.
 */
export type ErrorPageMessages = {
  title: string
  /** Có mã tra cứu */
  description: string
  /** Không có mã tra cứu (lỗi chỉ xảy ra ở trình duyệt, Next không gắn digest) */
  descriptionNoRef: string
  reference: string
  retry: string
  backHome: string
}

// error.tsx bắt buộc là client component và Next không truyền props từ server vào nó. Layout (server) dịch sẵn
// 6 chuỗi (ErrorPageMessages) và đặt vào context này, error.tsx đọc lại: vẫn là "client leaf nhận chuỗi đã dịch từ
// server", không kéo useTranslations (runtime dịch của next-intl) vào bundle đầu của mọi trang.
const ErrorMessagesContext = createContext<ErrorPageMessages | null>(null)

export function ErrorMessagesProvider({ messages, children }: { messages: ErrorPageMessages; children: ReactNode }) {
  return <ErrorMessagesContext value={messages}>{children}</ErrorMessagesContext>
}

export function useErrorMessages() {
  const messages = use(ErrorMessagesContext)
  if (!messages) throw new Error('useErrorMessages: thiếu ErrorMessagesProvider trong layout')
  return messages
}

type Props = {
  messages: ErrorPageMessages
  /** `error.digest`: mã Next gắn cho lỗi ở server, cùng mã trong log server (Vercel → Logs) */
  digest?: string
  /** `retry` của Next: tải lại dữ liệu server của segment rồi render lại */
  onRetry: () => void
  /** Link về trang chủ: Link của next-intl khi còn layout, `<a>` ở global-error / admin */
  homeLink: (className: string) => ReactNode
}

/**
 * Nội dung trang lỗi dùng chung các boundary: câu trung tính (lỗi phía web), mã tra cứu (digest) + email liên hệ.
 * Không hiện error.message (có thể lộ chi tiết nội bộ); digest chỉ là chuỗi băm, tra được trong log server.
 * Chỉ dùng React + class Tailwind (không Button / radix / next-intl / lucide-react): global-error là một nhóm chunk
 * riêng nhưng tải ở mọi trang, và Turbopack chép lại mọi module nó import thay vì dùng chung với layout (+~21KB gzip
 * khi còn import; lõi lucide ~1KB nên 2 icon là SVG inline, cùng path với CloudOff / RotateCcw của lucide).
 */
export function ErrorView({ messages, digest, onRetry, homeLink }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Nội dung trang vừa bị thay bằng trang lỗi → đưa focus về tiêu đề để trình đọc màn hình đọc ngay
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="mx-auto flex max-w-reading flex-col items-start px-4 py-24" data-testid="error-page">
      <Icon className="size-10 text-subtle">
        <path d="M10.94 5.274A7 7 0 0 1 15.71 10h1.79a4.5 4.5 0 0 1 4.222 6.057" />
        <path d="M18.796 18.81A4.5 4.5 0 0 1 17.5 19H9A7 7 0 0 1 5.79 5.78" />
        <path d="m2 2 20 20" />
      </Icon>
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 font-serif text-3xl font-medium outline-none">
        {messages.title}
      </h1>
      <p className="mt-4 text-muted-foreground">
        <WithSupportEmail text={digest ? messages.description : messages.descriptionNoRef} />
      </p>
      {digest && (
        <p className="mt-3 text-sm text-subtle" data-testid="error-reference">
          {messages.reference.replace('{digest}', () => digest)}
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-5 text-base font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-focus-ring"
        >
          <Icon className="size-4">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </Icon>
          {messages.retry}
        </button>
        {homeLink(
          'inline-flex h-11 items-center rounded-lg border border-input px-5 text-base font-medium transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-focus-ring',
        )}
      </div>
    </div>
  )
}

/**
 * Chỗ trống `{email}` → link mailto. Cùng kết quả với SupportEmailText + fillTemplate nhưng viết riêng ở đây: module
 * nào ErrorView import cũng bị chép thêm một bản vào nhóm chunk global-error (tải ở mọi trang).
 */
function WithSupportEmail({ text }: { text: string }) {
  return text.split('{email}').map((part, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <a
          // mailto: không phải link nội bộ
          // eslint-disable-next-line no-restricted-syntax
          href={`mailto:${SUPPORT_EMAIL}`}
          className="rounded-sm break-all underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-focus-ring"
        >
          {SUPPORT_EMAIL}
        </a>
      )}
      {part}
    </Fragment>
  ))
}

function Icon({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}
