import { PlusIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminLink } from '@/components/admin/admin-link'
import { AdminPage } from '@/components/admin/admin-page'
import { AdminPagination } from '@/components/admin/admin-pagination'
import { TableSkeleton } from '@/components/admin/table-skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { authorListHref, authorListParamsSchema } from '@/features/admin/authors/params'
import { listAdminAuthors } from '@/features/admin/authors/queries'
import { ADMIN_PAGE_SIZE } from '@/features/admin/params'
import { cn } from '@/lib/utils'

export async function generateMetadata() {
  const t = await getTranslations('admin.authors')
  return { title: t('title') }
}

export default async function AdminAuthorsPage({ searchParams }: PageProps<'/admin/tac-gia'>) {
  const t = await getTranslations('admin.authors')
  return (
    <AdminPage
      title={t('title')}
      actions={
        <AdminLink href="/admin/tac-gia/moi" className={buttonVariants({ size: 'lg', className: 'h-11 px-4' })}>
          <PlusIcon aria-hidden />
          {t('new')}
        </AdminLink>
      }
    >
      <Suspense fallback={<TableSkeleton withFilters />}>
        <AuthorList searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  )
}

const cell = 'px-3 py-3 align-middle'
const headCell = 'px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'

async function AuthorList({ searchParams }: { searchParams: PageProps<'/admin/tac-gia'>['searchParams'] }) {
  const params = authorListParamsSchema.parse(await searchParams)
  const [t, tCommon, { authors, total }] = await Promise.all([
    getTranslations('admin.authors'),
    getTranslations('admin.common'),
    listAdminAuthors(params),
  ])

  return (
    <div className="grid gap-6">
      {/* Form GET: chạy không cần JS, từ khóa nằm trên URL */}
      <form
        method="get"
        action="/admin/tac-gia"
        role="search"
        aria-label={t('search')}
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-surface p-4"
      >
        <div className="min-w-60 flex-1">
          <TextField
            name="q"
            type="search"
            label={t('search')}
            placeholder={t('searchHint')}
            defaultValue={params.q ?? ''}
            maxLength={100}
            idPrefix="filter"
          />
        </div>
        <Button type="submit" size="lg" className="h-11 px-5">
          {tCommon('filter')}
        </Button>
        {params.q && (
          <AdminLink href="/admin/tac-gia" className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'h-11 px-4' })}>
            {tCommon('clearFilters')}
          </AdminLink>
        )}
      </form>
      <p className="text-sm text-muted-foreground" role="status">
        {t('count', { count: total })}
      </p>
      {authors.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">
          {params.q ? t('emptyFiltered') : t('empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-xl text-sm">
            <caption className="sr-only">{t('table.caption')}</caption>
            <thead className="border-b bg-surface">
              <tr>
                <th scope="col" className={headCell}>
                  {t('table.name')}
                </th>
                <th scope="col" className={headCell}>
                  {t('table.slug')}
                </th>
                <th scope="col" className={cn(headCell, 'text-right')}>
                  {t('table.books')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {authors.map((author) => (
                <tr key={author.id} className="hover:bg-surface">
                  <th scope="row" className={cn(cell, 'text-left font-normal')}>
                    <AdminLink
                      href={`/admin/tac-gia/${author.id}`}
                      className="rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-focus-ring"
                    >
                      {author.name}
                    </AdminLink>
                  </th>
                  <td className={cn(cell, 'font-mono text-xs text-muted-foreground')}>{author.slug}</td>
                  <td className={cn(cell, 'text-right tabular-nums')}>{author.bookCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AdminPagination
        page={params.page ?? 1}
        totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)}
        hrefFor={(target) => authorListHref(params, { page: target })}
      />
    </div>
  )
}
