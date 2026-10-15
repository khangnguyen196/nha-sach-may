import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { AdminLink, type AdminHref } from './admin-link'

type Props = { page: number; totalPages: number; hrefFor: (page: number) => AdminHref }

const item = buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'text-muted-foreground' })

/** Trang trước / sau bằng link thật (chạy không cần JS); bảng admin không cần dãy số trang */
export async function AdminPagination({ page, totalPages, hrefFor }: Props) {
  if (totalPages <= 1) return null
  const t = await getTranslations('admin.common.pagination')

  return (
    <nav aria-label={t('label')} className="mt-6 flex items-center justify-end gap-2">
      {page > 1 ? (
        <AdminLink href={hrefFor(page - 1)} rel="prev" className={item}>
          <ChevronLeftIcon aria-hidden />
          <span className="sr-only">{t('previous')}</span>
        </AdminLink>
      ) : (
        <span aria-hidden className={`${item} opacity-40`}>
          <ChevronLeftIcon />
        </span>
      )}
      <span className="text-sm text-muted-foreground tabular-nums">{t('status', { page, total: totalPages })}</span>
      {page < totalPages ? (
        <AdminLink href={hrefFor(page + 1)} rel="next" className={item}>
          <ChevronRightIcon aria-hidden />
          <span className="sr-only">{t('next')}</span>
        </AdminLink>
      ) : (
        <span aria-hidden className={`${item} opacity-40`}>
          <ChevronRightIcon />
        </span>
      )}
    </nav>
  )
}
