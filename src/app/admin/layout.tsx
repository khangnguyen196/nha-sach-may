import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense, type ReactNode } from 'react'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { requireAdmin } from '@/features/admin/queries'
import { fontVariables } from '../fonts'
import '../globals.css'

// Root layout thứ hai: admin chỉ tiếng Việt, không nằm dưới [locale]
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin')
  return { title: t('title'), robots: { index: false, follow: false } }
}

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <html lang="vi" className={fontVariables} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Suspense>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  )
}

// Kiểm tra quyền lần hai ở server (proxy là lần một): không dựa vào việc ẩn UI
async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin()
  return children
}
