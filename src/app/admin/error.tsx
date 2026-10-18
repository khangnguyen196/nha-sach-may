'use client'

import { ErrorView, useErrorMessages } from '@/components/layout/error-view'
import { GLOBAL_ERROR_MESSAGES } from '@/i18n/global-error-messages'

// Admin chỉ tiếng Việt; chuỗi do admin/layout.tsx đặt vào context.
export default function AdminErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const messages = useErrorMessages()
  return (
    <main>
      <ErrorView
        messages={messages}
        digest={error.digest}
        onRetry={retry}
        homeLink={(className) => (
          // Admin nằm ngoài [locale] (không có Link của next-intl); về cửa hàng là tải lại cả trang
          // eslint-disable-next-line no-restricted-syntax
          <a href={GLOBAL_ERROR_MESSAGES.vi.homeHref} className={className}>
            {messages.backHome}
          </a>
        )}
      />
    </main>
  )
}
