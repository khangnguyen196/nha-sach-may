import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense, type ReactNode } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { ErrorMessagesProvider } from '@/components/layout/error-view'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { requireAdmin } from '@/features/admin/auth'
import { fontVariables } from '../fonts'
import '../globals.css'

// Root layout thứ hai: admin chỉ tiếng Việt, không nằm dưới [locale]
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin')
  return { title: { default: t('title'), template: `%s · ${t('title')}` }, robots: { index: false, follow: false } }
}

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const [t, tCommon] = await Promise.all([getTranslations('errorPage'), getTranslations('common')])
  return (
    <html lang="vi" className={fontVariables} suppressHydrationWarning>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {tCommon('skipToContent')}
        </a>
        <ThemeProvider>
          <ErrorMessagesProvider
            messages={{ title: t('title'), description: t('description'), retry: t('retry'), backHome: t('backHome') }}
          >
            <Suspense>
              <AdminGate>
                <AdminShell>{children}</AdminShell>
              </AdminGate>
            </Suspense>
          </ErrorMessagesProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

// Kiểm tra quyền lần hai ở server (proxy là lần một): không dựa vào việc ẩn UI. Khung điều hướng cũng nằm sau cổng.
async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin()
  return children
}
