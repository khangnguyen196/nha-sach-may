import { StarIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import type { FormMessages } from '@/lib/form-messages'
import { deleteReview, saveReview } from '../actions'
import { getReviewFormLabels } from '../form-labels'
import type { MyReview } from '../queries'
import { REVIEW_CONTENT_MAX } from '../schemas'
import { RatingStars } from './rating-stars'
import { ReviewForm } from './review-form'

type Props = { bookId: number; review: MyReview | null; messages: FormMessages }

/**
 * Đánh giá ngay trên dòng sách của đơn đã giao. <details> mở form ngay dưới dòng, không thêm JS và chạy được khi chưa
 * có JS. Cùng action với trang sách (mỗi người một đánh giá / sách): lưu ở đây thì trang sách cũng đổi (updateTag).
 */
export async function OrderItemReview({ bookId, review, messages }: Props) {
  const [t, labels] = await Promise.all([getTranslations('review'), getReviewFormLabels(review !== null)])
  return (
    <details className="group mt-3" data-testid="order-item-review">
      <summary
        className={buttonVariants({
          variant: 'outline',
          size: 'sm',
          className: 'h-8 cursor-pointer list-none gap-2 [&::-webkit-details-marker]:hidden',
        })}
      >
        {review ? (
          <>
            <RatingStars rating={review.rating} />
            <span className="sr-only">{t('average', { rating: review.rating })}</span>
            {t('edit')}
          </>
        ) : (
          t('rate')
        )}
      </summary>
      <div className="mt-3 rounded-lg border bg-surface-raised/40 p-4">
        <ReviewForm
          save={saveReview.bind(null, bookId)}
          remove={review ? deleteReview.bind(null, bookId) : null}
          messages={messages}
          contentMax={REVIEW_CONTENT_MAX}
          defaults={{ rating: review?.rating ?? null, content: review?.content ?? null }}
          labels={labels}
          starIcon={<StarIcon aria-hidden />}
          idPrefix={`review-${bookId}`}
        />
      </div>
    </details>
  )
}
