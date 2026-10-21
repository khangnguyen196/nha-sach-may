import type { MetadataRoute } from 'next'
import { getCategories, getSitemapAuthors, getSitemapBooks } from '@/features/books/queries'
import { visibleCategoryIds } from '@/features/books/utils'
import { siteUrl } from '@/lib/site-url'
import { sitemapEntries } from '@/lib/sitemap'

/** /sitemap.xml: < 1.000 URL nên một file (không cần generateSitemaps) */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, books, authors] = await Promise.all([getCategories(), getSitemapBooks(), getSitemapAuthors()])
  // Chỉ danh mục nằm trong cây đang hiện: danh mục con của gốc đã ẩn (RLS vẫn trả dòng con) không lên sitemap,
  // sách của chúng cũng vậy (VD dữ liệu e2e: gốc ẩn + con hiện)
  const visibleIds = new Set(visibleCategoryIds(categories))
  return sitemapEntries(siteUrl(), {
    categories: categories.filter((category) => visibleIds.has(category.id)),
    books: books.filter((book) => book.category_id !== null && visibleIds.has(book.category_id)),
    // Tác giả có ít nhất một sách lên danh sách (cùng quy tắc với trang tác giả / inVisibleCategories: không danh mục hoặc
    // danh mục đang hiện); chỉ có sách thuộc danh mục ẩn → trang rỗng, không đưa lên sitemap
    authors: authors
      .filter((author) => author.books.some((book) => book.category_id === null || visibleIds.has(book.category_id)))
      .map((author) => author.slug),
  })
}
