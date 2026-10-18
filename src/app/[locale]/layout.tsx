import type { Metadata } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locale as rootLocale } from 'next/root-params'
import { getErrorPageMessages } from '@/components/layout/error-page-messages'
import { ErrorMessagesProvider } from '@/components/layout/error-view'
import { Header } from '@/components/layout/header'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { routing } from '@/i18n/routing'
import { siteUrl } from '@/lib/site-url'
import { fontVariables } from '../fonts'
import '../globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const [t, tCommon, locale] = await Promise.all([getTranslations('metadata'), getTranslations('common'), rootLocale()])
  return {
    // URL tuyệt đối cho og:image, canonical, hreflang (SITE_URL → domain Vercel → localhost)
    metadataBase: new URL(siteUrl()),
    title: { default: t('title'), template: `%s · ${tCommon('siteName')}` },
    description: t('description'),
    // Ảnh mặc định: opengraph-image.png cùng thư mục (scripts/og-image.ts); trang sách dùng bìa sách
    openGraph: { siteName: tCommon('siteName'), type: 'website', locale: locale === 'en' ? 'en_US' : 'vi_VN' },
  }
}

export default async function LocaleLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await rootLocale()
  if (!hasLocale(routing.locales, locale)) notFound()

  const [t, errorMessages, messages] = await Promise.all([
    getTranslations('common'),
    getErrorPageMessages(),
    getMessages(),
  ])

  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {t('skipToContent')}
        </a>
        <ThemeProvider>
          {/* Client chỉ nhận namespace còn dùng useTranslations (palette, tải lười). Client leaf khác nhận
              chuỗi đã dịch qua props → không gửi cả file messages xuống, không kéo intl-messageformat vào bundle đầu. */}
          <NextIntlClientProvider messages={{ search: messages.search }}>
            <Header />
            {/* <main> + footer do layout của từng route group dựng: (shop) có footer đầy đủ, (auth) chỉ dòng bản quyền */}
            {/* Chuỗi cho error.tsx (client, không nhận props từ server): xem components/layout/error-view.tsx */}
            <ErrorMessagesProvider messages={errorMessages}>
              {children}
            </ErrorMessagesProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
