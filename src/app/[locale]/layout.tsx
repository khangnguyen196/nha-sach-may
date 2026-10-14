import type { Metadata } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locale as rootLocale } from 'next/root-params'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { routing } from '@/i18n/routing'
import { fontVariables } from '../fonts'
import '../globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const [t, tCommon] = await Promise.all([getTranslations('metadata'), getTranslations('common')])
  return {
    title: { default: t('title'), template: `%s · ${tCommon('siteName')}` },
    description: t('description'),
  }
}

export default async function LocaleLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await rootLocale()
  if (!hasLocale(routing.locales, locale)) notFound()

  const t = await getTranslations('common')

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
          <NextIntlClientProvider>
            <Header />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
