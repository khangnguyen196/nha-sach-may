import { GRID_CLASS } from './book-grid'

/** Cùng khung với BookCard (bìa 2:3, 2 dòng tên, 1 dòng tác giả, 1 dòng giá) → không nhảy layout khi lưới stream vào */
export function BookCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className}>
      <div className="aspect-[2/3] animate-pulse rounded-cover bg-surface-raised" />
      <div className="mt-3 text-sm">
        <div className="flex h-[2lh] flex-col justify-around">
          <div className="h-3.5 animate-pulse rounded-sm bg-surface-raised" />
          <div className="h-3.5 w-2/3 animate-pulse rounded-sm bg-surface-raised" />
        </div>
      </div>
      <div className="mt-1 flex h-[1lh] items-center text-xs">
        <div className="h-3 w-1/2 animate-pulse rounded-sm bg-surface-raised" />
      </div>
      <div className="mt-1.5 flex h-[1lh] items-center text-sm">
        <div className="h-3.5 w-1/3 animate-pulse rounded-sm bg-surface-raised" />
      </div>
    </div>
  )
}

export function BookGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ul aria-hidden className={GRID_CLASS}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <BookCardSkeleton />
        </li>
      ))}
    </ul>
  )
}

/** Toolbar (số kết quả + sort) + lưới: fallback của mọi trang catalog */
export function CatalogSkeleton({ withChips = false }: { withChips?: boolean }) {
  return (
    <div aria-hidden>
      {withChips && (
        <div className="mb-6 flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-surface-raised" />
          ))}
        </div>
      )}
      <div className="mb-6 flex h-9 items-center justify-between gap-3">
        <div className="h-4 w-28 animate-pulse rounded-sm bg-surface-raised" />
        <div className="h-9 w-40 animate-pulse rounded-lg bg-surface-raised" />
      </div>
      <BookGridSkeleton />
    </div>
  )
}

/** Đường dẫn + tiêu đề + lưới: fallback của trang danh mục / tác giả khi slug chưa prerender (stream theo request) */
export function PageHeaderSkeleton() {
  return (
    <div aria-hidden>
      <div className="h-5 w-40 animate-pulse rounded-sm bg-surface-raised" />
      <div className="mt-6 mb-8 h-10 w-64 max-w-full animate-pulse rounded-sm bg-surface-raised md:mb-10" />
      <CatalogSkeleton />
    </div>
  )
}
