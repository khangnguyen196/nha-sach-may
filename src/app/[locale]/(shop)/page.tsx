import { getLocale, getTranslations } from 'next-intl/server'
import { BookGrid } from '@/features/books/components/book-grid'
import { getCategories, getNewBooks } from '@/features/books/queries'
import { Link } from '@/i18n/navigation'
import { localize } from '@/lib/i18n-db'

const categoryLink =
  'rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50'

// Trang chủ tạm: Phase 8 thay bằng hero + các kệ (Nổi bật, Bán chạy, Mới về) + lưới danh mục.
export default async function HomePage() {
  const [t, locale, categories, books] = await Promise.all([
    getTranslations('home'),
    getLocale(),
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
          <div className="mt-6">
            <BookGrid books={books} />
          </div>
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
                <Link
                  href={{ pathname: '/categories/[slug]', params: { slug: parent.slug } }}
                  className={`font-medium ${categoryLink}`}
                >
                  {localize(parent, 'name', locale)}
                </Link>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {categories
                    .filter((child) => child.parent_id === parent.id)
                    .map((child) => (
                      <li key={child.id}>
                        <Link
                          href={{ pathname: '/categories/[slug]', params: { slug: child.slug } }}
                          className={categoryLink}
                        >
                          {localize(child, 'name', locale)}
                        </Link>
                      </li>
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
