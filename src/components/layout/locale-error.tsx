'use client'

import { Link } from '@/i18n/navigation'
import { ErrorView, useErrorMessages } from './error-view'

/** Trang lỗi bên dưới layout [locale]: chuỗi từ context của layout, link về trang chủ giữ locale */
export function LocaleError({ retry }: { retry: () => void }) {
  const messages = useErrorMessages()
  return (
    <ErrorView
      messages={messages}
      onRetry={retry}
      homeLink={(className) => (
        <Link href="/" className={className}>
          {messages.backHome}
        </Link>
      )}
    />
  )
}
