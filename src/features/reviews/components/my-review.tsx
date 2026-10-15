import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { getPathname, Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getFormMessages } from '@/lib/form-messages'
import { placeholder } from '@/lib/template'
import { deleteReview, saveReview } from '../actions'
import { getMyReviewState } from '../queries'
import { REVIEW_CONTENT_MAX } from '../schemas'
import { ReviewForm } from './review-form'

type Props = { bookId: number; slug: string; locale: Locale }

/**
 * Phần theo phiên của khối đánh giá (trong <Suspense> riêng, static shell của trang sách không đổi): chưa đăng nhập →
 * link đăng nhập; chưa nhận sách → giải thích; đủ điều kiện / đã viết → form.
 */
export async function MyReview({ bookId, slug, locale }: Props) {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations('review')])
  const bookPath = getPathname({ href: { pathname: '/books/[slug]', params: { slug } }, locale })

  if (!user) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="review-login">
        {t('loginPrompt')}{' '}
        <Link
          href={{ pathname: '/login', query: { next: bookPath } }}
          className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('login')}
        </Link>
      </p>
    )
  }

  const [{ review, eligible }, messages] = await Promise.all([
    getMyReviewState(bookId, user.id),
    getFormMessages(['REVIEW_NOT_ALLOWED', 'AUTH_REQUIRED']),
  ])
  if (!review && !eligible) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="review-not-eligible">
        {t('notEligible')}
      </p>
    )
  }

  return (
    <section aria-labelledby="my-review-title" className="rounded-lg border bg-surface p-5">
      <h3 id="my-review-title" className="mb-4 font-semibold">
        {review ? t('yourTitle') : t('writeTitle')}
      </h3>
      <ReviewForm
        save={saveReview.bind(null, bookId)}
        remove={review ? deleteReview.bind(null, bookId) : null}
        messages={messages}
        contentMax={REVIEW_CONTENT_MAX}
        defaults={{ rating: review?.rating ?? null, content: review?.content ?? null }}
        labels={{
          ratingLabel: t('ratingLabel'),
          ratingOptions: [1, 2, 3, 4, 5].map((rating) => t('ratingOption', { rating })),
          contentLabel: t('contentLabel'),
          contentHint: t('contentHint'),
          contentCount: t('contentCount', { count: placeholder('count'), max: REVIEW_CONTENT_MAX }),
          submit: review ? t('update') : t('submit'),
          saving: t('saving'),
          saved: t('saved'),
          delete: t('delete'),
          deleting: t('deleting'),
          deleted: t('deleted'),
        }}
      />
    </section>
  )
}
