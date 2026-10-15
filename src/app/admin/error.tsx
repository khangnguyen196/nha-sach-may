'use client'

import { ErrorView, useErrorMessages } from '@/components/layout/error-view'
import { localizedPath } from '@/i18n/paths'
import { routing } from '@/i18n/routing'

// Admin chỉ tiếng Việt; chuỗi do admin/layout.tsx đặt vào context.
export default function AdminErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const messages = useErrorMessages()
  return (
    <main>
      <ErrorView
        messages={messages}
        onRetry={retry}
        homeLink={(className) => (
          // Admin nằm ngoài [locale] (không có Link của next-intl); về cửa hàng là tải lại cả trang
          // eslint-disable-next-line no-restricted-syntax
          <a href={localizedPath('/', routing.defaultLocale)} className={className}>
            {messages.backHome}
          </a>
        )}
      />
    </main>
  )
}
