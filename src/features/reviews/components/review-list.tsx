import { BadgeCheckIcon } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import { getBookReviews } from '../queries'
import { RatingStars } from './rating-stars'

/** Đánh giá mới nhất của sách (cache chung, tag book:{id}); stream trong <Suspense> dưới phần chi tiết sách */
export async function ReviewList({ bookId }: { bookId: number }) {
  const [{ reviews, total }, t, format] = await Promise.all([
    getBookReviews(bookId),
    getTranslations('review'),
    getFormatter(),
  ])
  if (reviews.length === 0) return <p className="text-muted-foreground">{t('none')}</p>

  return (
    <div>
      <ul className="divide-y border-y" data-testid="review-list">
        {reviews.map((review) => (
          <li key={review.id} className="py-5" data-testid="review">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <RatingStars rating={review.rating} />
              <span className="sr-only">{t('average', { rating: review.rating })}</span>
              <span className="font-medium">{review.display_name ?? t('anonymous')}</span>
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <BadgeCheckIcon aria-hidden className="size-3.5" />
                {t('verified')}
              </span>
              <time dateTime={review.created_at} className="text-xs text-subtle">
                {format.dateTime(new Date(review.created_at), 'short')}
              </time>
            </div>
            {review.content && <p className="mt-2 max-w-reading whitespace-pre-line">{review.content}</p>}
          </li>
        ))}
      </ul>
      {total > reviews.length && (
        <p className="mt-3 text-sm text-muted-foreground">{t('showing', { shown: reviews.length })}</p>
      )}
    </div>
  )
}

export function ReviewListSkeleton() {
  return (
    <div aria-hidden className="animate-pulse space-y-4 motion-reduce:animate-none">
      <div className="h-20 rounded-md bg-surface-raised" />
      <div className="h-20 rounded-md bg-surface-raised" />
    </div>
  )
}
