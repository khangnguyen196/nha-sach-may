'use client'

import { useTheme } from 'next-themes'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

// Icon và nhãn đổi theo class .dark trên <html> (next-themes gắn trước khi paint) thay vì theo state JS:
// server không biết theme → không cần chờ mounted, không lệch hydration.
// Nhãn nhận từ Server Component: client leaf không gọi useTranslations để intl-messageformat
// không vào bundle ban đầu (CLAUDE.md → ngân sách JS). Icon cũng do Server Component cha render rồi truyền vào: client
// leaf không import lucide (lõi Icon không vào bundle, perf-js bước C).
type Props = { labels: { toLight: string; toDark: string }; icons: { sun: ReactNode; moon: ReactNode } }

export function ThemeToggle({ labels, icons }: Props) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
    >
      <span className="hidden dark:contents">{icons.sun}</span>
      <span className="contents dark:hidden">{icons.moon}</span>
      <span className="sr-only hidden dark:inline">{labels.toLight}</span>
      <span className="sr-only dark:hidden">{labels.toDark}</span>
    </Button>
  )
}
