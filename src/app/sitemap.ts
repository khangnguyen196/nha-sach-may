import type { MetadataRoute } from 'next'
import { getCategories, getSitemapAuthors, getSitemapBooks } from '@/features/books/queries'
import { inVisibleCategories } from '@/features/books/utils'
import { siteUrl } from '@/lib/site-url'
import { sitemapEntries } from '@/lib/sitemap'

/** /sitemap.xml: < 1.000 URL nên một file (không cần generateSitemaps) */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, books, authors] = await Promise.all([getCategories(), getSitemapBooks(), getSitemapAuthors()])
  // Chỉ danh mục nằm trong cây đang hiện: danh mục con của gốc đã ẩn (RLS vẫn trả dòng con) không lên sitemap,
  // sách của chúng cũng vậy (VD dữ liệu e2e: gốc ẩn + con hiện)
  const ids = new Set(categories.map((category) => category.id))
  const visible = categories.filter((category) => category.parent_id === null || ids.has(category.parent_id))
  const visibleIds = new Set(visible.map((category) => category.id))
  return sitemapEntries(siteUrl(), {
    categories: visible,
    books: books.filter((book) => book.category_id !== null && visibleIds.has(book.category_id)),
    // Tác giả có ít nhất một sách lên danh sách (trang tác giả liệt kê như inVisibleCategories: không danh mục hoặc danh
    // mục đang hiện); chỉ có sách thuộc danh mục ẩn → trang rỗng, không đưa lên sitemap
    authors: authors.filter((author) => inVisibleCategories(author.books, categories).length > 0).map((author) => author.slug),
  })
}
