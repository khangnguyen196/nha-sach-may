import type { MetadataRoute } from 'next'
import { localizedPath, localizedSlugPath, type SlugPathname } from '@/i18n/paths'
import { routing } from '@/i18n/routing'

type Entry = MetadataRoute.Sitemap[number]

export type SitemapInput = {
  categories: { slug: string }[]
  books: { slug: string; updated_at: string }[]
  authors: string[]
}

/**
 * URL công khai cho sitemap.xml: trang chủ, Tất cả sách, danh mục, sách, tác giả. Mỗi trang một dòng (URL tiếng Việt)
 * kèm `alternates.languages` cho cả hai locale (hreflang). Trang riêng tư / tìm kiếm không có ở đây (noindex).
 */
export function sitemapEntries(base: string, { categories, books, authors }: SitemapInput): MetadataRoute.Sitemap {
  const staticEntry = (pathname: '/' | '/books'): Entry => ({
    url: `${base}${localizedPath(pathname, routing.defaultLocale)}`,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((locale) => [locale, `${base}${localizedPath(pathname, locale)}`])),
    },
  })
  const slugEntry = (pathname: SlugPathname, slug: string, lastModified?: string): Entry => ({
    url: `${base}${localizedSlugPath(pathname, slug, routing.defaultLocale)}`,
    ...(lastModified && { lastModified }),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, `${base}${localizedSlugPath(pathname, slug, locale)}`]),
      ),
    },
  })

  return [
    staticEntry('/'),
    staticEntry('/books'),
    ...categories.map((category) => slugEntry('/categories/[slug]', category.slug)),
    ...books.map((book) => slugEntry('/books/[slug]', book.slug, book.updated_at)),
    ...authors.map((slug) => slugEntry('/authors/[slug]', slug)),
  ]
}
