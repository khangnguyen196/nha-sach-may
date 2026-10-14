import { BookOpenIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  icon?: LucideIcon
  /** VD link "Xóa bộ lọc" */
  action?: ReactNode
}

/** Dùng chung: danh mục rỗng, tìm kiếm không có kết quả, bộ lọc quá chặt */
export function EmptyState({ title, description, icon: Icon = BookOpenIcon, action }: Props) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-16 text-center">
      <Icon aria-hidden className="size-8 text-subtle" />
      <p className="mt-4 font-serif text-xl font-medium">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
