'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { AdminLink, type AdminHref } from './admin-link'

export type AdminNavItem = { href: AdminHref; label: string; icon: ReactNode }

/** Client chỉ để biết mục đang mở (aria-current); icon và nhãn render sẵn ở server */
export function AdminNav({ label, items }: { label: string; items: AdminNavItem[] }) {
  const pathname = usePathname()
  const isCurrent = (href: AdminHref) =>
    href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav aria-label={label}>
      <ul className="flex gap-1 overflow-x-auto px-4 pb-2 md:flex-col md:px-3 md:pb-0">
        {items.map((item) => (
          <li key={item.href}>
            <AdminLink
              href={item.href}
              aria-current={isCurrent(item.href) ? 'page' : undefined}
              className="flex h-9 items-center gap-2.5 rounded-md px-3 text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-surface-raised hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-surface-raised aria-[current=page]:font-medium aria-[current=page]:text-foreground [&_svg]:size-4"
            >
              {item.icon}
              {item.label}
            </AdminLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
