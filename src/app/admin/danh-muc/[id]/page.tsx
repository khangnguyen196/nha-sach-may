import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AdminBackLink, AdminPage } from '@/components/admin/admin-page'
import { FormSkeleton } from '@/components/admin/form-skeleton'
import { ShopLink } from '@/components/admin/shop-link'
import { updateCategory } from '@/features/admin/categories/actions'
import { CategoryForm } from '@/features/admin/categories/components/category-form'
import { getCategoryFormProps } from '@/features/admin/categories/form-props'
import { getAdminCategories, getAdminCategory } from '@/features/admin/categories/queries'
import { rowIdSchema } from '@/features/admin/schemas'

type Props = PageProps<'/admin/danh-muc/[id]'>

export async function generateMetadata() {
  const t = await getTranslations('admin.categories')
  return { title: t('editTitle') }
}

export default async function EditCategoryPage({ params }: Props) {
  const t = await getTranslations('admin.categories')
  return (
    <AdminPage title={t('editTitle')} before={<AdminBackLink href="/admin/danh-muc" label={t('title')} />}>
      <Suspense fallback={<FormSkeleton sections={2} />}>
        <EditCategory params={params} />
      </Suspense>
    </AdminPage>
  )
}

async function EditCategory({ params }: { params: Props['params'] }) {
  const { id: rawId } = await params
  const id = rowIdSchema.safeParse(rawId)
  if (!id.success) notFound()

  const [category, categories, { messages, labels }, tCommon] = await Promise.all([
    getAdminCategory(id.data),
    getAdminCategories(),
    getCategoryFormProps('edit'),
    getTranslations('admin.common'),
  ])
  if (!category) notFound()

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="font-serif text-2xl font-medium">{category.name}</h2>
        <ShopLink
          pathname="/categories/[slug]"
          slug={category.slug}
          label={tCommon('viewInShop')}
          newTabLabel={tCommon('opensInNewTab')}
          hiddenLabel={category.is_active ? undefined : tCommon('hiddenInShop')}
        />
      </div>
      <CategoryForm
        action={updateCategory.bind(null, category.id)}
        messages={messages}
        labels={labels}
        parents={categories.filter((parent) => parent.parent_id === null && parent.id !== category.id)}
        cancelHref="/admin/danh-muc"
        initial={category}
      />
    </div>
  )
}
