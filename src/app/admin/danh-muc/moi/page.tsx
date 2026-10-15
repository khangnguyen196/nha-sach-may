import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminBackLink, AdminPage } from '@/components/admin/admin-page'
import { FormSkeleton } from '@/components/admin/form-skeleton'
import { createCategory } from '@/features/admin/categories/actions'
import { CategoryForm } from '@/features/admin/categories/components/category-form'
import { getCategoryFormProps } from '@/features/admin/categories/form-props'
import { getAdminCategories } from '@/features/admin/categories/queries'

export async function generateMetadata() {
  const t = await getTranslations('admin.categories')
  return { title: t('newTitle') }
}

export default async function NewCategoryPage() {
  const t = await getTranslations('admin.categories')
  return (
    <AdminPage title={t('newTitle')} before={<AdminBackLink href="/admin/danh-muc" label={t('title')} />}>
      <Suspense fallback={<FormSkeleton sections={2} />}>
        <NewCategoryForm />
      </Suspense>
    </AdminPage>
  )
}

async function NewCategoryForm() {
  const [{ messages, labels }, categories] = await Promise.all([getCategoryFormProps('create'), getAdminCategories()])
  return (
    <CategoryForm
      action={createCategory}
      messages={messages}
      labels={labels}
      parents={categories.filter((category) => category.parent_id === null)}
      cancelHref="/admin/danh-muc"
      initial={{
        name: '',
        name_en: null,
        slug: '',
        description: null,
        description_en: null,
        parent_id: null,
        sort_order: 0,
        is_active: true,
      }}
    />
  )
}
