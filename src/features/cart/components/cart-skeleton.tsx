/** Cùng khung với CartView (danh sách | tóm tắt) để nội dung thật thay vào không xô trang */
export function CartSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div aria-hidden className="mt-8 grid animate-pulse gap-8 motion-reduce:animate-none lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
      <ul className="divide-y border-y">
        {Array.from({ length: lines }, (_, index) => (
          <li key={index} className="flex gap-4 py-5">
            <div className="aspect-[2/3] w-16 shrink-0 rounded-cover bg-surface-raised sm:w-20" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-3/4 rounded-sm bg-surface-raised" />
              <div className="h-3 w-1/3 rounded-sm bg-surface-raised" />
              <div className="h-3 w-1/5 rounded-sm bg-surface-raised" />
              <div className="mt-4 h-9 w-32 rounded-md bg-surface-raised" />
            </div>
          </li>
        ))}
      </ul>
      <div className="h-72 rounded-lg border bg-surface" />
    </div>
  )
}
