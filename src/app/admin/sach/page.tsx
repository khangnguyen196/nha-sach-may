import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminPage } from '@/components/admin/admin-page'
import { AdminPagination } from '@/components/admin/admin-pagination'
import { TableSkeleton } from '@/components/admin/table-skeleton'
import { BookFilters } from '@/features/admin/books/components/book-filters'
import { BookTable } from '@/features/admin/books/components/book-table'
import { bookListHref, bookListParamsSchema } from '@/features/admin/books/params'
import { listAdminBooks } from '@/features/admin/books/queries'
import { getAdminCategories } from '@/features/admin/categories/queries'
import { leafCategoryGroups } from '@/features/admin/categories/tree'
import { ADMIN_PAGE_SIZE } from '@/features/admin/params'

export async function generateMetadata() {
  const t = await getTranslations('admin.books')
  return { title: t('title') }
}

export default async function AdminBooksPage({ searchParams }: PageProps<'/admin/sach'>) {
  const t = await getTranslations('admin.books')
  return (
    <AdminPage title={t('title')}>
      <Suspense fallback={<TableSkeleton withFilters />}>
        <BookList searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  )
}

async function BookList({ searchParams }: { searchParams: PageProps<'/admin/sach'>['searchParams'] }) {
  const params = bookListParamsSchema.parse(await searchParams)
  const [t, { books, total }, categories] = await Promise.all([
    getTranslations('admin.books'),
    listAdminBooks(params),
    getAdminCategories(),
  ])
  const page = params.page ?? 1

  return (
    <div className="grid gap-6">
      <BookFilters params={params} categoryGroups={leafCategoryGroups(categories)} />
      <p className="text-sm text-muted-foreground" role="status">
        {t('count', { count: total })}
      </p>
      {books.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">{t('empty')}</p>
      ) : (
        <BookTable books={books} />
      )}
      <AdminPagination
        page={page}
        totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)}
        hrefFor={(target) => bookListHref(params, { page: target })}
      />
    </div>
  )
}
