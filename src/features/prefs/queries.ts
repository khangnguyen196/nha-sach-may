import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { cache } from 'react'
import type { Href } from '@/i18n/navigation'
import { localize } from '@/lib/i18n-db'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { parseBlockRow, parseBlockRows, type StoredBlock } from './blocks'

/**
 * Mục chặn của người đang đăng nhập (lọc `user_id` tường minh + RLS `user_blocks_select_own`), kèm id dòng. Client theo
 * phiên, không 'use cache' (dữ liệu theo user) → chỉ gọi trong <Suspense>, sau getCurrentUser. `React.cache`: layout,
 * trang sách, Mây trong cùng request dùng chung một lần đọc. Dòng sai bị bỏ (parseBlockRows).
 */
export const getMyBlocks = cache(async (userId: string): Promise<StoredBlock[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_blocks')
    .select('id, kind, category_id, author_id, publisher_id, warning')
    .eq('user_id', userId)
  if (error) throw new Error(`getMyBlocks: ${error.code ?? 'unknown'}`)
  return parseBlockRows(data)
})

/**
 * Khóa chặn của một cuốn kèm tên đích (khối "Sở thích" ở trang sách): BookDetail không có id NXB / id tác giả. Dữ liệu
 * catalog chung → 'use cache' cùng tag với trang sách (admin sửa sách → updateTag book:{id}).
 */
export async function getBookBlockTargets(bookId: number) {
  'use cache'
  cacheTag('books', `book:${bookId}`)
  cacheLife('hours')

  const { data, error } = await createPublicClient()
    .from('books')
    .select('id, category_id, publisher_id, content_warnings, publishers(name), book_authors(role, author_id, authors(name))')
    .eq('id', bookId)
    .maybeSingle()
  if (error) throw new Error(`getBookBlockTargets: ${error.message}`)
  return data
}

export type BookBlockTargets = NonNullable<Awaited<ReturnType<typeof getBookBlockTargets>>>

export type BlockListItem = {
  rowId: number
  /** null: đích không còn đọc được (VD danh mục vừa bị ẩn: RLS categories_public_read) */
  name: string | null
  href: Href | null
}

export type BlockList = {
  total: number
  category: BlockListItem[]
  author: BlockListItem[]
  publisher: BlockListItem[]
  warning: BlockListItem[]
}

/**
 * Danh sách chặn cho trang Sở thích: một query kèm tên đích, theo thứ tự thêm. Theo phiên (không cache chung),
 * `React.cache` trong một request. Tên danh mục theo locale (localize), nhãn dịch bằng contentWarnings.labels.
 */
export const getMyBlockList = cache(async (userId: string, locale: Locale): Promise<BlockList> => {
  const supabase = await createClient()
  const [{ data, error }, t] = await Promise.all([
    supabase
      .from('user_blocks')
      .select(
        'id, kind, category_id, author_id, publisher_id, warning, categories(name, name_en, slug), authors(name, slug), publishers(name)',
      )
      .eq('user_id', userId)
      .order('created_at')
      .order('id'),
    getTranslations({ locale, namespace: 'contentWarnings' }),
  ])
  if (error) throw new Error(`getMyBlockList: ${error.code ?? 'unknown'}`)

  // total đếm mọi dòng như trigger giới hạn của DB (dòng sai bị bỏ khỏi danh sách nhưng vẫn chiếm chỗ)
  const list: BlockList = { total: data.length, category: [], author: [], publisher: [], warning: [] }
  for (const row of data) {
    const block = parseBlockRow(row)
    if (!block) continue
    const { rowId } = block
    if (block.kind === 'warning') {
      list.warning.push({ rowId, name: t(`labels.${block.warning}`), href: null })
    } else if (block.kind === 'category') {
      const category = row.categories
      list.category.push({
        rowId,
        name: category ? localize(category, 'name', locale) : null,
        href: category ? { pathname: '/categories/[slug]', params: { slug: category.slug } } : null,
      })
    } else if (block.kind === 'author') {
      const author = row.authors
      list.author.push({
        rowId,
        name: author?.name ?? null,
        href: author ? { pathname: '/authors/[slug]', params: { slug: author.slug } } : null,
      })
    } else {
      list.publisher.push({ rowId, name: row.publishers?.name ?? null, href: null })
    }
  }
  return list
})
