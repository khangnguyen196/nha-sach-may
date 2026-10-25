import { getFormatter, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminLink } from '@/components/admin/admin-link'
import { AdminPage } from '@/components/admin/admin-page'
import { AdminPagination } from '@/components/admin/admin-pagination'
import { TableSkeleton } from '@/components/admin/table-skeleton'
import { WARNING_LIMITS } from '@/features/chat/config'
import { getAdminFormMessages } from '@/features/admin/form-messages'
import { ADMIN_PAGE_SIZE } from '@/features/admin/params'
import { reviewSuggestion } from '@/features/admin/warnings/actions'
import { BatchSuggest } from '@/features/admin/warnings/components/batch-suggest'
import { ReviewForm } from '@/features/admin/warnings/components/review-form'
import { suggestionListHref, suggestionListParamsSchema } from '@/features/admin/warnings/params'
import { countUnreviewedBooks, listPendingSuggestions } from '@/features/admin/warnings/queries'
import { CONTENT_WARNINGS } from '@/features/warnings/labels'
import { warningSuggestEnabled } from '@/features/warnings/mode'
import { placeholder } from '@/lib/template'

// Server Action của trang (suggestNextBatch, mỗi lần một lượt Gemini tới 25 giây + RPC) chạy trong function của trang
// này: như /admin/sach/[id], 60 giây = tối đa của Vercel Hobby khi không bật Fluid. Số viết thẳng (Next đọc tĩnh).
export const maxDuration = 60

type Props = PageProps<'/admin/canh-bao'>

export async function generateMetadata() {
  const t = await getTranslations('admin.warnings')
  return { title: t('title') }
}

/** Cảnh báo nội dung: gợi ý nhãn bằng AI cho sách chưa xét, duyệt / bỏ qua gợi ý (chỉ tiếng Việt) */
export default async function AdminWarningsPage({ searchParams }: Props) {
  const t = await getTranslations('admin.warnings')
  return (
    <AdminPage title={t('title')}>
      <Suspense fallback={<TableSkeleton />}>
        <Warnings searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  )
}

async function Warnings({ searchParams }: { searchParams: Props['searchParams'] }) {
  const params = suggestionListParamsSchema.parse(await searchParams)
  const [t, tLabels, format, messages, counts, { suggestions, total }] = await Promise.all([
    getTranslations('admin.warnings'),
    getTranslations('contentWarnings.labels'),
    getFormatter(),
    getAdminFormMessages(['WARNING_QUOTA_EXCEEDED', 'WARNING_AI_FAILED', 'SUGGESTION_STATUS_CHANGED']),
    countUnreviewedBooks(),
    listPendingSuggestions(params),
  ])
  const options = CONTENT_WARNINGS.map((value) => ({ value, label: tLabels(value) }))
  const labelNames = (labels: readonly (typeof CONTENT_WARNINGS)[number][]) => labels.map((label) => tLabels(label)).join(', ')
  const intervalMs = 60_000 / WARNING_LIMITS.callsPerMinute

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 rounded-lg border bg-surface p-5" aria-labelledby="warnings-batch">
        <h2 id="warnings-batch" className="sr-only">
          {t('batch.start')}
        </h2>
        <p className="max-w-reading text-sm">{t('intro')}</p>
        <p className="text-sm font-medium" data-testid="warnings-counts">
          {t('counts', counts)}
        </p>
        {warningSuggestEnabled() ? (
          <BatchSuggest
            messages={messages}
            intervalMs={intervalMs}
            disabled={counts.unsuggested === 0}
            labels={{
              start: t('batch.start'),
              starting: t('batch.starting'),
              stop: t('batch.stop'),
              hint: t('batch.hint', { books: WARNING_LIMITS.booksPerCall, seconds: Math.ceil(intervalMs / 1000) }),
              running: t('batch.running', { n: placeholder('n') }),
              waiting: t('batch.waiting', { n: placeholder('n'), seconds: placeholder('seconds') }),
              cooling: t('batch.cooling', { seconds: placeholder('seconds') }),
              totals: t('batch.totals', { inserted: placeholder('inserted') }),
              done: t('batch.done'),
              stopped: t('batch.stopped'),
              stalled: t('batch.stalled'),
              missing: t('batch.missing'),
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('off')}</p>
        )}
      </section>

      <section className="grid gap-4" aria-labelledby="warnings-list">
        <h2 id="warnings-list" className="text-lg font-semibold">
          {t('list.label')}
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          <p className="text-muted-foreground" role="status">
            {t('list.count', { count: total })}
          </p>
          {params.sach && (
            <p>
              {t('list.filtered')}{' '}
              <AdminLink href={suggestionListHref({})} className="text-primary underline-offset-4 hover:underline">
                {t('list.showAll')}
              </AdminLink>
            </p>
          )}
        </div>
        {suggestions.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">{t('list.empty')}</p>
        ) : (
          <ul className="divide-y rounded-lg border" data-testid="warning-suggestions">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id} className="grid gap-4 p-4 md:p-5" data-testid="warning-suggestion">
                <div className="grid gap-1">
                  <h3 className="font-medium">
                    {suggestion.books ? (
                      <AdminLink
                        href={`/admin/sach/${suggestion.books.id}`}
                        className="underline-offset-4 hover:text-primary hover:underline"
                      >
                        {suggestion.books.title}
                      </AdminLink>
                    ) : (
                      t('list.bookDeleted')
                    )}
                  </h3>
                  <p className="text-xs text-subtle">
                    {t('list.createdAt', { time: format.dateTime(new Date(suggestion.created_at), 'withTime') })}
                    {suggestion.model && <> · {t('list.model', { model: suggestion.model })}</>}
                  </p>
                  {suggestion.books && (
                    <p className="text-sm text-muted-foreground">
                      {suggestion.books.content_warnings.length > 0
                        ? t('list.currentLabels', { labels: labelNames(suggestion.books.content_warnings) })
                        : t('list.noCurrentLabels')}
                    </p>
                  )}
                </div>
                <div className="grid gap-1 rounded-md bg-surface-raised p-3 text-sm">
                  <p className="font-medium">{t('list.reason')}</p>
                  <p className="max-w-reading">{suggestion.reason}</p>
                  <p className="text-xs text-muted-foreground">{t('list.reasonHint')}</p>
                </div>
                {suggestion.books && (
                  <ReviewForm
                    action={reviewSuggestion.bind(null, suggestion.id)}
                    messages={messages}
                    labels={{
                      legend: t('list.labels'),
                      approve: t('list.approve'),
                      dismiss: t('list.dismiss'),
                      saving: t('list.saving'),
                    }}
                    options={options}
                    suggested={suggestion.labels}
                    expectedReviewedAt={suggestion.books.content_warnings_reviewed_at}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <AdminPagination
          page={params.page ?? 1}
          totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)}
          hrefFor={(target) => suggestionListHref(params, { page: target })}
        />
      </section>
    </div>
  )
}
