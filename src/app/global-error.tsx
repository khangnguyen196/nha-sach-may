'use client'

import { useParams } from 'next/navigation'
import { useLayoutEffect } from 'react'
import { ErrorView } from '@/components/layout/error-view'
import { GLOBAL_ERROR_MESSAGES, isGlobalErrorLocale } from '@/i18n/global-error-messages'
import { fontVariables } from './fonts'
import './globals.css'

// Lỗi ở root layout ([locale]/layout.tsx, admin/layout.tsx): thay cả <html>, không còn layout nên tự mang theo CSS,
// font và chuỗi (xem i18n/global-error-messages.ts). /admin không có [locale] → tiếng Việt.
// Không import next-intl, next-themes, routing hay Button: global-error tải ở mọi trang dưới dạng nhóm chunk riêng,
// mọi module nó import bị chép thêm một bản (xem components/layout/error-view.tsx).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { locale } = useParams()
  const lang = isGlobalErrorLocale(locale) ? locale : 'vi'
  const messages = GLOBAL_ERROR_MESSAGES[lang]

  // Giữ theme người dùng đã chọn (next-themes lưu ở localStorage `theme`; dark là mặc định của token)
  useLayoutEffect(() => {
    try {
      if (localStorage.getItem('theme') === 'light') document.documentElement.classList.add('light')
    } catch {
      // localStorage bị chặn → giữ dark
    }
  }, [])

  return (
    <html lang={lang} className={fontVariables} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <title>{messages.title}</title>
        <main id="main" className="flex-1">
          <ErrorView
            messages={messages}
            digest={error.digest}
            onRetry={retry}
            homeLink={(className) => (
              // Không còn provider của next-intl cho Link; tải lại cả trang là đúng ý sau lỗi root layout.
              // eslint-disable-next-line no-restricted-syntax
              <a href={messages.homeHref} className={className}>
                {messages.backHome}
              </a>
            )}
          />
        </main>
      </body>
    </html>
  )
}
