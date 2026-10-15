/** Khung chờ cho bảng danh sách admin: cùng chiều cao hàng với bảng thật, tránh nhảy trang khi dữ liệu về */
export function TableSkeleton({ rows = 8, withFilters = false }: { rows?: number; withFilters?: boolean }) {
  return (
    <div aria-hidden className="grid gap-6">
      {withFilters && <div className="h-24 animate-pulse rounded-lg border bg-surface motion-reduce:animate-none" />}
      <div className="overflow-hidden rounded-lg border">
        <div className="h-10 border-b bg-surface" />
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex h-18.5 items-center gap-3 border-b px-3 last:border-b-0">
            <div className="h-12 w-9 animate-pulse rounded-cover bg-surface-raised motion-reduce:animate-none" />
            <div className="h-4 w-1/3 animate-pulse rounded-sm bg-surface-raised motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  )
}
