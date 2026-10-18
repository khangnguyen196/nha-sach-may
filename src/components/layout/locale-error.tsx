'use client'

import { Link } from '@/i18n/navigation'
import { ErrorView, useErrorMessages } from './error-view'

/** Trang lỗi bên dưới layout [locale]: chuỗi từ context của layout, link về trang chủ giữ locale */
export function LocaleError({ digest, retry }: { digest?: string; retry: () => void }) {
  const messages = useErrorMessages()
  return (
    <ErrorView
      messages={messages}
      digest={digest}
      onRetry={retry}
      homeLink={(className) => (
        <Link href="/" className={className}>
          {messages.backHome}
        </Link>
      )}
    />
  )
}
