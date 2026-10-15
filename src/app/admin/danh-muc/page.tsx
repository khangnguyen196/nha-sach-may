import { PlusIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminLink } from '@/components/admin/admin-link'
import { AdminPage } from '@/components/admin/admin-page'
import { TableSkeleton } from '@/components/admin/table-skeleton'
import { buttonVariants } from '@/components/ui/button'
import { listAdminCategories } from '@/features/admin/categories/queries'
import { categoryTree } from '@/features/admin/categories/tree'
import { cn } from '@/lib/utils'

export async function generateMetadata() {
  const t = await getTranslations('admin.categories')
  return { title: t('title') }
}

export default async function AdminCategoriesPage() {
  const t = await getTranslations('admin.categories')
  return (
    <AdminPage
      title={t('title')}
      actions={
        <AdminLink href="/admin/danh-muc/moi" className={buttonVariants({ size: 'lg', className: 'h-11 px-4' })}>
          <PlusIcon aria-hidden />
          {t('new')}
        </AdminLink>
      }
    >
      <Suspense fallback={<TableSkeleton />}>
        <CategoryTable />
      </Suspense>
    </AdminPage>
  )
}

const cell = 'px-3 py-3 align-middle'
const headCell = 'px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'

async function CategoryTable() {
  const [t, tCommon, categories] = await Promise.all([
    getTranslations('admin.categories'),
    getTranslations('admin.common'),
    listAdminCategories(),
  ])
  if (categories.length === 0) {
    return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">{t('empty')}</p>
  }

  // Danh mục con nằm ngay dưới danh mục cha, thụt vào một bậc
  const rows = categoryTree(categories).flatMap(({ root, children }) => [
    { category: root, child: false },
    ...children.map((category) => ({ category, child: true })),
  ])

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-2xl text-sm">
        <caption className="sr-only">{t('table.caption')}</caption>
        <thead className="border-b bg-surface">
          <tr>
            <th scope="col" className={headCell}>
              {t('table.name')}
            </th>
            <th scope="col" className={headCell}>
              {t('table.nameEn')}
            </th>
            <th scope="col" className={headCell}>
              {t('table.slug')}
            </th>
            <th scope="col" className={cn(headCell, 'text-right')}>
              {t('table.order')}
            </th>
            <th scope="col" className={cn(headCell, 'text-right')}>
              {t('table.books')}
            </th>
            <th scope="col" className={headCell}>
              {t('table.status')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ category, child }) => (
            <tr key={category.id} className="hover:bg-surface">
              <th scope="row" className={cn(cell, 'text-left font-normal', child && 'pl-8')}>
                {child && (
                  <span aria-hidden className="mr-2 text-subtle">
                    └
                  </span>
                )}
                <AdminLink
                  href={`/admin/danh-muc/${category.id}`}
                  className={cn(
                    'rounded-sm outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50',
                    !child && 'font-medium',
                  )}
                >
                  {category.name}
                </AdminLink>
              </th>
              <td className={cn(cell, 'text-muted-foreground')}>{category.name_en ?? '—'}</td>
              <td className={cn(cell, 'font-mono text-xs text-muted-foreground')}>{category.slug}</td>
              <td className={cn(cell, 'text-right tabular-nums')}>{category.sort_order}</td>
              <td className={cn(cell, 'text-right tabular-nums')}>{category.bookCount}</td>
              <td className={cell}>
                <span
                  className={cn(
                    'inline-flex rounded-sm px-2 py-0.5 text-xs',
                    category.is_active ? 'bg-success/10 text-success' : 'bg-surface-raised text-muted-foreground',
                  )}
                >
                  {category.is_active ? tCommon('active') : tCommon('hidden')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
