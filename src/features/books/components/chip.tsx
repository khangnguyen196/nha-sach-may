import type { ReactNode } from 'react'
import { Link, type Href } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/** Chip link (lọc / danh mục con): hàng chip ở trang danh mục, bộ lọc, kệ danh mục trang chủ */
export function Chip({ href, active = false, children }: { href: Href; active?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex h-8 items-center rounded-full border px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-focus-ring',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-input text-muted-foreground hover:bg-surface-raised hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
