import { getFormatter, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { ActionButtonForm } from '@/components/admin/action-button-form'
import { AdminLink } from '@/components/admin/admin-link'
import { AdminPage } from '@/components/admin/admin-page'
import { AdminPagination } from '@/components/admin/admin-pagination'
import { ShopLink } from '@/components/admin/shop-link'
import { TableSkeleton } from '@/components/admin/table-skeleton'
import { buttonVariants } from '@/components/ui/button'
import { getAdminFormMessages } from '@/features/admin/form-messages'
import { ADMIN_PAGE_SIZE } from '@/features/admin/params'
import { deleteReviewAsAdmin } from '@/features/admin/reviews/actions'
import { RATINGS, reviewListHref, reviewListParamsSchema } from '@/features/admin/reviews/params'
import { listAdminReviews } from '@/features/admin/reviews/queries'
import { RatingStars } from '@/features/reviews/components/rating-stars'
import { cn } from '@/lib/utils'

export async function generateMetadata() {
  const t = await getTranslations('admin.reviews')
  return { title: t('title') }
}

/** Kiểm duyệt đánh giá: mới nhất trước, lọc theo số sao, gỡ đánh giá không phù hợp */
export default async function AdminReviewsPage({ searchParams }: PageProps<'/admin/danh-gia'>) {
  const t = await getTranslations('admin.reviews')
  return (
    <AdminPage title={t('title')}>
      <Suspense fallback={<TableSkeleton withFilters />}>
        <ReviewList searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  )
}

async function ReviewList({ searchParams }: { searchParams: PageProps<'/admin/danh-gia'>['searchParams'] }) {
  const params = reviewListParamsSchema.parse(await searchParams)
  const [t, tCommon, format, messages, { reviews, total }] = await Promise.all([
    getTranslations('admin.reviews'),
    getTranslations('admin.common'),
    getFormatter(),
    getAdminFormMessages([]),
    listAdminReviews(params),
  ])
  const chip = (active: boolean) =>
    buttonVariants({ variant: active ? 'secondary' : 'ghost', size: 'sm', className: cn(active && 'font-semibold') })

  return (
    <div className="grid gap-6">
      <nav aria-label={t('filterLabel')} className="flex flex-wrap gap-2">
        <AdminLink
          href={reviewListHref(params, { sao: undefined, page: undefined })}
          aria-current={params.sao ? undefined : 'true'}
          className={chip(!params.sao)}
        >
          {t('allRatings')}
        </AdminLink>
        {RATINGS.map((rating) => (
          <AdminLink
            key={rating}
            href={reviewListHref(params, { sao: rating, page: undefined })}
            aria-current={params.sao === rating ? 'true' : undefined}
            className={chip(params.sao === rating)}
          >
            {t('stars', { rating })}
          </AdminLink>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground" role="status">
        {t('count', { count: total })}
      </p>
      {reviews.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="divide-y rounded-lg border" data-testid="admin-reviews">
          {reviews.map((review) => (
            <li key={review.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start" data-testid="admin-review">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <RatingStars rating={review.rating} />
                  <span className="sr-only">{t('stars', { rating: review.rating })}</span>
                  <span className="font-medium">{review.display_name ?? t('anonymous')}</span>
                  <span className="text-subtle">
                    {format.dateTime(new Date(review.created_at), { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">{t('book')}: </span>
                  {review.books ? (
                    <ShopLink
                      pathname="/books/[slug]"
                      slug={review.books.slug}
                      label={review.books.title}
                      newTabLabel={tCommon('opensInNewTab')}
                    />
                  ) : (
                    t('bookDeleted')
                  )}
                </p>
                {review.content ? (
                  <p className="mt-2 max-w-reading text-sm whitespace-pre-line">{review.content}</p>
                ) : (
                  <p className="mt-2 text-sm text-subtle">{t('noContent')}</p>
                )}
              </div>
              <ActionButtonForm
                action={deleteReviewAsAdmin.bind(null, review.id)}
                messages={messages}
                label={t('delete')}
                pendingLabel={t('deleting')}
              />
            </li>
          ))}
        </ul>
      )}
      <AdminPagination
        page={params.page ?? 1}
        totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)}
        hrefFor={(target) => reviewListHref(params, { page: target })}
      />
    </div>
  )
}
