'use client'

import { MoonIcon, SunIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

// Icon và nhãn đổi theo class .dark trên <html> (next-themes gắn trước khi paint) thay vì theo state JS:
// server không biết theme → không cần chờ mounted, không lệch hydration.
export function ThemeToggle() {
  const t = useTranslations('layout')
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
    >
      <SunIcon aria-hidden className="hidden dark:block" />
      <MoonIcon aria-hidden className="dark:hidden" />
      <span className="sr-only hidden dark:inline">{t('toLightTheme')}</span>
      <span className="sr-only dark:hidden">{t('toDarkTheme')}</span>
    </Button>
  )
}
