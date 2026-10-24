/** Khung form đăng / sửa tin lúc chờ phiên + dữ liệu (cao gần bằng form thật, tránh nhảy trang) */
export function ListingFormSkeleton() {
  return (
    <div aria-hidden className="grid animate-pulse gap-6 motion-reduce:animate-none">
      <div className="h-[112px] rounded-lg bg-surface-raised" />
      <div className="h-[196px] rounded-lg bg-surface-raised sm:h-[124px]" />
      <div className="h-[100px] rounded-lg bg-surface-raised" />
      <div className="h-[160px] rounded-lg bg-surface-raised" />
      <div className="h-[200px] rounded-lg bg-surface-raised" />
      <div className="h-11 w-36 rounded-lg bg-surface-raised" />
    </div>
  )
}
