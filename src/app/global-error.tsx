'use client'

import { hasLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { ErrorView } from '@/components/layout/error-view'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { GLOBAL_ERROR_MESSAGES } from '@/i18n/global-error-messages'
import { localizedPath } from '@/i18n/paths'
import { routing } from '@/i18n/routing'
import { fontVariables } from './fonts'
import './globals.css'

// Lỗi ở root layout ([locale]/layout.tsx, admin/layout.tsx): thay cả <html>, không còn layout nên tự mang theo
// CSS, font, theme và chuỗi (xem i18n/global-error-messages.ts). /admin không có [locale] → tiếng Việt.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { locale } = useParams()
  const lang = typeof locale === 'string' && hasLocale(routing.locales, locale) ? locale : routing.defaultLocale
  const messages = GLOBAL_ERROR_MESSAGES[lang]

  return (
    <html lang={lang} className={fontVariables} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <title>{messages.title}</title>
        <ThemeProvider>
          <main id="main" className="flex-1">
            <ErrorView
              messages={messages}
              onRetry={retry}
              homeLink={(className) => (
                // Không còn provider của next-intl cho Link; tải lại cả trang là đúng ý sau lỗi root layout.
                // eslint-disable-next-line no-restricted-syntax
                <a href={localizedPath('/', lang)} className={className}>
                  {messages.backHome}
                </a>
              )}
            />
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
