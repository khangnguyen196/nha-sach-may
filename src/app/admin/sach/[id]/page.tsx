import { BookIcon } from 'lucide-react'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ActionButtonForm } from '@/components/admin/action-button-form'
import { AdminBackLink, AdminPage } from '@/components/admin/admin-page'
import { FormSkeleton } from '@/components/admin/form-skeleton'
import { ShopLink } from '@/components/admin/shop-link'
import { setBookActive, updateBook, uploadCover } from '@/features/admin/books/actions'
import { BookForm } from '@/features/admin/books/components/book-form'
import { CoverForm } from '@/features/admin/books/components/cover-form'
import { getBookFormProps } from '@/features/admin/books/form-props'
import { getAdminBook, getBookFormOptions } from '@/features/admin/books/queries'
import { getAdminCategories } from '@/features/admin/categories/queries'
import { leafCategoryGroups } from '@/features/admin/categories/tree'
import { getAdminFormMessages } from '@/features/admin/form-messages'
import { rowIdSchema } from '@/features/admin/schemas'
import { COVER_MAX_BYTES } from '@/lib/cover-image'

type Props = PageProps<'/admin/sach/[id]'>

// Server Action gọi từ trang này chạy trong function của trang (tài liệu Next: route segment config → maxDuration). Nút
// "Gợi ý bằng AI" một cuốn = một lượt Gemini (tới WARNING_GEMINI.timeoutMs = 25 giây) + RPC trừ lượt + insert gợi ý; trần
// mặc định của nền tảng có thể ngắn hơn (Vercel Hobby không bật Fluid: 10 giây) → bị ngắt giữa chừng khi lượt đã trừ.
// 60 giây = mức tối đa của Hobby khi không bật Fluid. Phải là số viết thẳng (Next đọc tĩnh lúc build).
export const maxDuration = 60

export async function generateMetadata() {
  const t = await getTranslations('admin.books')
  return { title: t('editTitle') }
}

export default async function EditBookPage({ params }: Props) {
  const t = await getTranslations('admin.books')
  return (
    <AdminPage title={t('editTitle')} before={<AdminBackLink href="/admin/sach" label={t('title')} />}>
      <Suspense fallback={<FormSkeleton />}>
        <EditBook params={params} />
      </Suspense>
    </AdminPage>
  )
}

const panel = 'grid gap-4 rounded-lg border bg-surface p-5'

async function EditBook({ params }: { params: Props['params'] }) {
  const { id: rawId } = await params
  const id = rowIdSchema.safeParse(rawId)
  if (!id.success) notFound()

  const [book, categories, options, formProps, actionMessages, t, tCommon] = await Promise.all([
    getAdminBook(id.data),
    getAdminCategories(),
    getBookFormOptions(),
    getBookFormProps(),
    getAdminFormMessages(),
    getTranslations('admin.books'),
    getTranslations('admin.common'),
  ])
  if (!book) notFound()

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
      <div className="grid min-w-0 gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="font-serif text-2xl font-medium">{book.title}</h2>
          <ShopLink
            pathname="/books/[slug]"
            slug={book.slug}
            label={tCommon('viewInShop')}
            newTabLabel={tCommon('opensInNewTab')}
            hiddenLabel={book.is_active ? undefined : tCommon('hiddenInShop')}
          />
        </div>
        <BookForm
          action={updateBook.bind(null, book.id)}
          messages={formProps.messages}
          labels={formProps.labels}
          book={book}
          categoryGroups={leafCategoryGroups(categories)}
          publishers={options.publishers}
          authors={options.authors}
        />
      </div>

      <aside className="grid gap-6 lg:sticky lg:top-6">
        <section aria-labelledby="cover-title" className={panel}>
          <h2 id="cover-title" className="text-sm font-semibold">
            {t('sections.cover')}
          </h2>
          <div className="relative aspect-[2/3] w-32 overflow-hidden rounded-cover bg-surface-raised">
            {book.cover_url ? (
              <Image
                src={book.cover_url}
                alt={t('cover.current', { title: book.title })}
                fill
                sizes="128px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center text-xs text-subtle">
                <BookIcon aria-hidden className="size-6" />
                {t('cover.none')}
              </span>
            )}
          </div>
          <CoverForm
            action={uploadCover.bind(null, book.id)}
            messages={formProps.coverMessages}
            labels={formProps.coverLabels}
            maxBytes={COVER_MAX_BYTES}
          />
        </section>

        <section aria-labelledby="visibility-title" className={panel}>
          <h2 id="visibility-title" className="text-sm font-semibold">
            {t('sections.visibility')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {book.is_active ? t('visibility.active') : t('visibility.hidden')}
          </p>
          <ActionButtonForm
            action={setBookActive.bind(null, book.id, !book.is_active)}
            messages={actionMessages}
            label={book.is_active ? t('visibility.hide') : t('visibility.show')}
            pendingLabel={book.is_active ? t('visibility.hiding') : t('visibility.showing')}
          />
        </section>
      </aside>
    </div>
  )
}
