'use client'

import type { ReactNode } from 'react'
import { useRouter, type Href } from '@/i18n/navigation'

type Option = { value: string; label: string; href: Href }

type Props = {
  label: string
  value: string
  options: Option[]
  /** Icon do Server Component cha render (client leaf không import lucide, perf-js bước C) */
  icon: ReactNode
}

/** href của từng lựa chọn do server tính sẵn (giữ filter, reset trang) → client chỉ điều hướng */
export function SortSelect({ label, value, options, icon }: Props) {
  const router = useRouter()

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          const option = options.find((o) => o.value === event.target.value)
          if (option) router.push(option.href)
        }}
        className="h-9 appearance-none rounded-lg border border-input bg-surface py-0 pr-9 pl-3 text-base text-foreground sm:text-sm transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-3 flex text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
    </label>
  )
}
