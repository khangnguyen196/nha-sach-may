import Image from 'next/image'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { getCategories, getNewBooks } from '@/features/books/queries'
import { localize } from '@/lib/i18n-db'

// Trang tạm của Phase 1: kiểm tra chuỗi Supabase → localize → token màu → font → bìa từ Storage qua next/image.
// Phase 8 thay bằng các kệ sách.
export default async function HomePage() {
  const [t, locale, format, categories, books] = await Promise.all([
    getTranslations('home'),
    getLocale(),
    getFormatter(),
    getCategories(),
    getNewBooks(),
  ])
  const parents = categories.filter((c) => c.parent_id === null)

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <figure className="max-w-reading">
        <blockquote className="font-serif text-2xl font-medium text-foreground md:text-3xl">“{t('quote')}”</blockquote>
        <figcaption className="mt-4 text-sm text-muted-foreground">— {t('quoteAuthor')}</figcaption>
      </figure>

      <section aria-labelledby="new-arrivals-title" className="mt-16 md:mt-24">
        <h2 id="new-arrivals-title" className="text-xl font-semibold">
          {t('newArrivals')}
        </h2>
        {books.length === 0 ? (
          <p className="mt-4 text-muted-foreground">{t('newArrivalsEmpty')}</p>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {books.map((book) => (
              <li key={book.id}>
                <div className="relative aspect-[2/3] overflow-hidden rounded-cover bg-surface-raised">
                  {book.cover_url && (
                    <Image
                      src={book.cover_url}
                      alt={book.title}
                      fill
                      sizes="(min-width: 1024px) 16vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover"
                    />
                  )}
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-medium">{book.title}</p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {book.book_authors.flatMap((ba) => ba.authors?.name ?? []).join(', ')}
                </p>
                <p className="mt-1 text-sm font-semibold text-primary">{format.number(book.price, 'price')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="categories-title" className="mt-16 md:mt-24">
        <h2 id="categories-title" className="text-xl font-semibold">
          {t('categoriesTitle')}
        </h2>
        {parents.length === 0 ? (
          <p className="mt-4 text-muted-foreground">{t('categoriesEmpty')}</p>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {parents.map((parent) => (
              <li key={parent.id} className="rounded-lg border bg-surface p-4">
                <p className="font-medium">{localize(parent, 'name', locale)}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {categories
                    .filter((child) => child.parent_id === parent.id)
                    .map((child) => (
                      <li key={child.id}>{localize(child, 'name', locale)}</li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
