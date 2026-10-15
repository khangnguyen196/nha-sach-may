import { ChevronLeftIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AdminLink, type AdminHref } from './admin-link'

/** Link quay lại danh sách, đặt trên tiêu đề trang sửa / thêm */
export function AdminBackLink({ href, label }: { href: AdminHref; label: string }) {
  return (
    <AdminLink
      href={href}
      className="mb-4 inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ChevronLeftIcon aria-hidden className="size-4" />
      {label}
    </AdminLink>
  )
}

/** Khung một trang admin: `<main id="main">` (đích của link "Bỏ qua"), tiêu đề, nút / link cạnh tiêu đề */
export function AdminPage({
  title,
  actions,
  before,
  children,
}: {
  title: string
  /** Cạnh tiêu đề, VD nút "Thêm danh mục" */
  actions?: ReactNode
  /** Trên tiêu đề, VD link quay lại danh sách */
  before?: ReactNode
  children: ReactNode
}) {
  return (
    <main id="main" className="min-w-0 px-4 py-6 sm:px-6 md:px-10 md:py-10">
      {before}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-3xl font-medium">{title}</h1>
        {actions}
      </div>
      <div className="mt-8">{children}</div>
    </main>
  )
}
