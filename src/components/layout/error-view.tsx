'use client'

import { CloudOffIcon, RotateCcwIcon } from 'lucide-react'
import { createContext, use, useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/** Chuỗi của trang lỗi, đã dịch (namespace `errorPage`) */
export type ErrorPageMessages = { title: string; description: string; retry: string; backHome: string }

// error.tsx bắt buộc là client component và Next không truyền props từ server vào nó. Layout (server) dịch sẵn
// 4 chuỗi và đặt vào context này, error.tsx đọc lại: vẫn là "client leaf nhận chuỗi đã dịch từ server", không kéo
// useTranslations (runtime dịch của next-intl) vào bundle đầu của mọi trang.
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
  /** `retry` của Next: tải lại dữ liệu server của segment rồi render lại */
  onRetry: () => void
  /** Link về trang chủ: Link của next-intl khi còn layout, `<a>` ở global-error / admin */
  homeLink: (className: string) => ReactNode
}

/**
 * Nội dung trang lỗi dùng chung các boundary. Không hiện error.message / digest: lỗi Server Component đã được Next
 * log ở server, production chỉ gửi xuống client một thông báo chung.
 */
export function ErrorView({ messages, onRetry, homeLink }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Nội dung trang vừa bị thay bằng trang lỗi → đưa focus về tiêu đề để trình đọc màn hình đọc ngay
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="mx-auto flex max-w-reading flex-col items-start px-4 py-24" data-testid="error-page">
      <CloudOffIcon aria-hidden className="size-10 text-subtle" />
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 font-serif text-3xl font-medium outline-none">
        {messages.title}
      </h1>
      <p className="mt-4 text-muted-foreground">{messages.description}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button size="lg" className="h-11 px-5 text-base" onClick={onRetry}>
          <RotateCcwIcon aria-hidden />
          {messages.retry}
        </Button>
        {homeLink(
          'inline-flex h-11 items-center rounded-lg border border-input px-5 text-base font-medium transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/50',
        )}
      </div>
    </div>
  )
}
