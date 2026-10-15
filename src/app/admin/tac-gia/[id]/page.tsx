import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ActionButtonForm } from '@/components/admin/action-button-form'
import { AdminLink } from '@/components/admin/admin-link'
import { AdminBackLink, AdminPage } from '@/components/admin/admin-page'
import { FormSkeleton } from '@/components/admin/form-skeleton'
import { ShopLink } from '@/components/admin/shop-link'
import { deleteAuthor, updateAuthor } from '@/features/admin/authors/actions'
import { AuthorForm } from '@/features/admin/authors/components/author-form'
import { getAuthorFormProps } from '@/features/admin/authors/form-props'
import { getAdminAuthor } from '@/features/admin/authors/queries'
import { getAdminFormMessages } from '@/features/admin/form-messages'
import { rowIdSchema } from '@/features/admin/schemas'

type Props = PageProps<'/admin/tac-gia/[id]'>

export async function generateMetadata() {
  const t = await getTranslations('admin.authors')
  return { title: t('editTitle') }
}

export default async function EditAuthorPage({ params }: Props) {
  const t = await getTranslations('admin.authors')
  return (
    <AdminPage title={t('editTitle')} before={<AdminBackLink href="/admin/tac-gia" label={t('title')} />}>
      <Suspense fallback={<FormSkeleton sections={2} />}>
        <EditAuthor params={params} />
      </Suspense>
    </AdminPage>
  )
}

const panel = 'grid gap-4 rounded-lg border bg-surface p-5'

async function EditAuthor({ params }: { params: Props['params'] }) {
  const { id: rawId } = await params
  const id = rowIdSchema.safeParse(rawId)
  if (!id.success) notFound()

  const [author, { messages, labels }, deleteMessages, t, tBooks, tCommon] = await Promise.all([
    getAdminAuthor(id.data),
    getAuthorFormProps('edit'),
    getAdminFormMessages(['AUTHOR_HAS_BOOKS']),
    getTranslations('admin.authors'),
    getTranslations('admin.books'),
    getTranslations('admin.common'),
  ])
  if (!author) notFound()

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
      <div className="grid min-w-0 gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="font-serif text-2xl font-medium">{author.name}</h2>
          <ShopLink
            pathname="/authors/[slug]"
            slug={author.slug}
            label={tCommon('viewInShop')}
            newTabLabel={tCommon('opensInNewTab')}
          />
        </div>
        <AuthorForm action={updateAuthor.bind(null, author.id)} messages={messages} labels={labels} initial={author} />
      </div>

      <aside className="grid gap-6">
        <section aria-labelledby="author-books-title" className={panel}>
          <h2 id="author-books-title" className="text-sm font-semibold">
            {tBooks('title')} ({author.books.length})
          </h2>
          {author.books.length > 0 && (
            <ul className="grid gap-1.5 text-sm">
              {author.books.map((book) => (
                <li key={book.id}>
                  <AdminLink
                    href={`/admin/sach/${book.id}`}
                    className="rounded-sm outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {book.title}
                  </AdminLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="author-delete-title" className={panel}>
          <h2 id="author-delete-title" className="text-sm font-semibold">
            {t('delete.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {author.books.length > 0 ? t('delete.hasBooks', { count: author.books.length }) : t('delete.hint')}
          </p>
          <ActionButtonForm
            action={deleteAuthor.bind(null, author.id)}
            messages={deleteMessages}
            label={t('delete.submit')}
            pendingLabel={t('delete.pending')}
            variant="destructive"
          />
        </section>
      </aside>
    </div>
  )
}
