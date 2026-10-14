'use client'

import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

// Icon và nhãn đổi theo class .dark trên <html> (next-themes gắn trước khi paint) thay vì theo state JS:
// server không biết theme → không cần chờ mounted, không lệch hydration.
// Nhãn nhận từ Server Component: client leaf không gọi useTranslations để intl-messageformat
// không vào bundle ban đầu (CLAUDE.md → ngân sách JS).
export function ThemeToggle({ labels }: { labels: { toLight: string; toDark: string } }) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
    >
      <SunIcon aria-hidden className="hidden dark:block" />
      <MoonIcon aria-hidden className="dark:hidden" />
      <span className="sr-only hidden dark:inline">{labels.toLight}</span>
      <span className="sr-only dark:hidden">{labels.toDark}</span>
    </Button>
  )
}
