import 'server-only'
import { getTranslations } from 'next-intl/server'
import { placeholder } from '@/lib/template'
import type { ReviewFormLabels } from './components/review-form'
import { REVIEW_CONTENT_MAX } from './schemas'

/** Nhãn đã dịch của ReviewForm: dùng chung khối đánh giá ở trang sách và dòng sách ở trang đơn đã giao */
export async function getReviewFormLabels(hasReview: boolean): Promise<ReviewFormLabels> {
  const t = await getTranslations('review')
  return {
    ratingLabel: t('ratingLabel'),
    ratingOptions: [1, 2, 3, 4, 5].map((rating) => t('ratingOption', { rating })),
    contentLabel: t('contentLabel'),
    contentHint: t('contentHint'),
    contentCount: t('contentCount', { count: placeholder('count'), max: REVIEW_CONTENT_MAX }),
    submit: hasReview ? t('update') : t('submit'),
    saving: t('saving'),
    saved: t('saved'),
    delete: t('delete'),
    deleting: t('deleting'),
    deleted: t('deleted'),
  }
}
