/** Cùng khung với AddressForm (5 ô + hàng nút) → không nhảy layout khi form stream vào */
export function AddressFormSkeleton() {
  return (
    <div aria-hidden className="grid animate-pulse gap-5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="grid gap-1.5">
          <div className="h-5 w-32 rounded-sm bg-surface-raised" />
          <div className="h-11 rounded-md bg-surface-raised" />
        </div>
      ))}
      <div className="h-11 w-36 rounded-lg bg-surface-raised" />
    </div>
  )
}
