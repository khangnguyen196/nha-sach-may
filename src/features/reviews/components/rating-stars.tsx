import { StarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 5 sao chỉ để nhìn (aria-hidden); câu đọc được ("4.5 trên 5 sao") do nơi dùng đặt cạnh, dạng sr-only hoặc chữ.
 * Không hook → dùng được ở Server Component.
 */
export function RatingStars({ rating, className }: { rating: number; className?: string }) {
  const filled = Math.round(rating)
  return (
    <span aria-hidden className={cn('inline-flex gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} className={cn('size-4', star <= filled ? 'fill-primary text-primary' : 'text-subtle')} />
      ))}
    </span>
  )
}
