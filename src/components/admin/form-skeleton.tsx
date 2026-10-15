/** Khung chờ cho trang sửa (form): vài khối cao như nhóm ô thật */
export function FormSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div aria-hidden className="grid gap-6">
      {Array.from({ length: sections }, (_, index) => (
        <div key={index} className="h-64 animate-pulse rounded-lg border bg-surface motion-reduce:animate-none" />
      ))}
    </div>
  )
}
