'use client'

import { useTheme } from 'next-themes'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { MENU_ITEM_CLASS } from './more-menu'

// Icon và nhãn đổi theo class .dark trên <html> (next-themes gắn trước khi paint) thay vì theo state JS:
// server không biết theme → không cần chờ mounted, không lệch hydration.
// Nhãn nhận từ Server Component: client leaf không gọi useTranslations để intl-messageformat
// không vào bundle ban đầu (CLAUDE.md → ngân sách JS). Icon cũng do Server Component cha render rồi truyền vào: chỉ bớt
// module của từng icon; lõi Icon vẫn tải (CLAUDE.md → Hiệu năng).
type Props = {
  labels: { toLight: string; toDark: string }
  icons: { sun: ReactNode; moon: ReactNode }
  /** icon: nút 36px trên header từ md; menu: mục có chữ trong menu "⋯" dưới md (MoreMenu) */
  variant: 'icon' | 'menu'
}

export function ThemeToggle({ labels, icons, variant }: Props) {
  const { resolvedTheme, setTheme } = useTheme()
  const label = variant === 'menu' ? '' : 'sr-only '

  return (
    <Button
      variant="ghost"
      // Mục menu: cỡ mặc định của Button + MENU_ITEM_CLASS (Button gộp bằng cn); icon-lg chỉ cho nút 36px
      size={variant === 'menu' ? 'default' : 'icon-lg'}
      className={variant === 'menu' ? MENU_ITEM_CLASS : undefined}
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
    >
      <span className="hidden dark:contents">{icons.sun}</span>
      <span className="contents dark:hidden">{icons.moon}</span>
      <span className={`${label}hidden dark:inline`}>{labels.toLight}</span>
      <span className={`${label}dark:hidden`}>{labels.toDark}</span>
    </Button>
  )
}
