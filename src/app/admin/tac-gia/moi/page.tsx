import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminBackLink, AdminPage } from '@/components/admin/admin-page'
import { FormSkeleton } from '@/components/admin/form-skeleton'
import { createAuthor } from '@/features/admin/authors/actions'
import { AuthorForm } from '@/features/admin/authors/components/author-form'
import { getAuthorFormProps } from '@/features/admin/authors/form-props'

export async function generateMetadata() {
  const t = await getTranslations('admin.authors')
  return { title: t('newTitle') }
}

export default async function NewAuthorPage() {
  const t = await getTranslations('admin.authors')
  return (
    <AdminPage title={t('newTitle')} before={<AdminBackLink href="/admin/tac-gia" label={t('title')} />}>
      <Suspense fallback={<FormSkeleton sections={2} />}>
        <NewAuthorForm />
      </Suspense>
    </AdminPage>
  )
}

async function NewAuthorForm() {
  const { messages, labels } = await getAuthorFormProps('create')
  return (
    <AuthorForm
      action={createAuthor}
      messages={messages}
      labels={labels}
      initial={{ name: '', slug: '', bio: null, bio_en: null }}
    />
  )
}
