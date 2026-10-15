import { getTranslations } from 'next-intl/server'
import { AdminLink } from '@/components/admin/admin-link'
import { AdminPage } from '@/components/admin/admin-page'
import { buttonVariants } from '@/components/ui/button'

// notFound() trong admin (id sách / danh mục / tác giả không tồn tại): trang 404 tiếng Việt, giữ khung admin
export default async function AdminNotFound() {
  const t = await getTranslations('admin.notFound')
  return (
    <AdminPage title={t('title')}>
      <p className="text-muted-foreground">{t('description')}</p>
      <AdminLink href="/admin" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'mt-6 h-11 px-5' })}>
        {t('back')}
      </AdminLink>
    </AdminPage>
  )
}
