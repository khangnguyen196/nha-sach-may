/** Cùng khung với trang thanh toán (địa chỉ, ghi chú, thanh toán | tóm tắt) để nội dung thật thay vào không xô trang */
export function CheckoutSkeleton() {
  return (
    <div aria-hidden className="mt-8 grid animate-pulse gap-8 motion-reduce:animate-none lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
      <div className="grid content-start gap-10">
        <div className="grid gap-3">
          <div className="h-6 w-40 rounded-sm bg-surface-raised" />
          <div className="h-[106px] rounded-lg bg-surface-raised" />
          <div className="h-9 w-36 rounded-md bg-surface-raised" />
        </div>
        <div className="grid gap-1.5">
          <div className="h-5 w-44 rounded-sm bg-surface-raised" />
          <div className="h-24 rounded-md bg-surface-raised" />
        </div>
        <div className="grid gap-4">
          <div className="h-6 w-48 rounded-sm bg-surface-raised" />
          <div className="h-[78px] rounded-lg bg-surface-raised" />
        </div>
      </div>
      <div className="h-96 rounded-lg border bg-surface" />
    </div>
  )
}
