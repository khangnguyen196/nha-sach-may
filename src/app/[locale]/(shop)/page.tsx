import { getLocale, getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { Shelf } from '@/features/books/components/shelf'
import { getCategories, getHomeShelves, type Category } from '@/features/books/queries'
import { visibleCategoryIds } from '@/features/books/utils'
import { Link } from '@/i18n/navigation'
import { localizedPath } from '@/i18n/paths'
import { localize } from '@/lib/i18n-db'
import { serializeJsonLd, websiteJsonLd } from '@/lib/json-ld'
import { siteUrl } from '@/lib/site-url'

const categoryLink =
  'rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50'

/** Nhánh danh mục sách tiếng Anh (supabase/seed-foreign-books.sql): một kệ riêng, không trộn vào "Mới về" */
const FOREIGN_CATEGORY_SLUG = 'sach-ngoai-van'

/** Sách chỉ gắn vào danh mục lá: danh mục cha → id các danh mục con */
function leafIds(categories: Category[], root: Category) {
  const children = categories.filter((c) => c.parent_id === root.id)
  return children.length > 0 ? children.map((c) => c.id) : [root.id]
}

/**
 * Hero (trích dẫn + 1 CTA) → kệ Nổi bật, Bán chạy, Mới về (sách tiếng Việt), Sách ngoại văn → lưới danh mục.
 * Prerender: mọi query qua 'use cache' + client anon. LCP là chữ hero; ảnh kệ lazy.
 */
export default async function HomePage() {
  const [t, tCommon, locale, categories] = await Promise.all([
    getTranslations('home'),
    getTranslations('common'),
    getLocale(),
    getCategories(),
  ])
  const foreignRoot = categories.find((c) => c.slug === FOREIGN_CATEGORY_SLUG)
  const shelves = await getHomeShelves(
    visibleCategoryIds(categories),
    foreignRoot ? leafIds(categories, foreignRoot) : [],
  )
  const parents = categories.filter((c) => c.parent_id === null)

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            websiteJsonLd({
              name: tCommon('siteName'),
              url: `${siteUrl()}${localizedPath('/', locale)}`,
              searchUrl: `${siteUrl()}${localizedPath('/search', locale)}`,
            }),
          ),
        }}
      />
      <div className="py-16 md:py-24">
        <figure className="max-w-reading">
          <blockquote className="font-serif text-2xl font-medium text-foreground md:text-3xl">“{t('quote')}”</blockquote>
          <figcaption className="mt-4 text-sm text-muted-foreground">— {t('quoteAuthor')}</figcaption>
        </figure>
        <Link href="/books" className={buttonVariants({ size: 'lg', className: 'mt-8 h-11 px-6 text-base' })}>
          {t('allBooks')}
        </Link>
      </div>

      <div className="space-y-12 md:space-y-20">
        <Shelf id="featured" title={t('featured')} books={shelves.featured} />
        <Shelf id="bestselling" title={t('bestselling')} href="/books" books={shelves.bestselling} />
        {shelves.newArrivals.length > 0 ? (
          <Shelf
            id="new-arrivals"
            title={t('newArrivals')}
            href={{ pathname: '/books', query: { lang: 'vi', sort: 'newest' } }}
            books={shelves.newArrivals}
          />
        ) : (
          <section aria-labelledby="new-arrivals">
            <h2 id="new-arrivals" className="text-xl font-semibold">
              {t('newArrivals')}
            </h2>
            <p className="mt-4 text-muted-foreground">{t('newArrivalsEmpty')}</p>
          </section>
        )}
        {foreignRoot && (
          <Shelf
            id="foreign-books"
            title={localize(foreignRoot, 'name', locale)}
            href={{ pathname: '/categories/[slug]', params: { slug: foreignRoot.slug } }}
            books={shelves.foreign}
          />
        )}
      </div>

      <section aria-labelledby="categories-title" className="py-12 md:py-20">
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
