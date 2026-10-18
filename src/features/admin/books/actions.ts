'use server'

import { randomBytes } from 'node:crypto'
import { refresh, updateTag } from 'next/cache'
import { after } from 'next/server'
import { COVER_MAX_BYTES, toCoverWebp } from '@/lib/cover-image'
import { invalidInput, toFailure, type Failure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '../auth'
import { adminCatalogTags, type BookSnapshot } from '../cache-tags'
import { storageObjectPath, violatedUniqueConstraint } from '../db-errors'
import { rowIdSchema } from '../schemas'
import { bookActiveSchema, bookFormInput, bookFormSchema } from './schemas'

// id (và trạng thái ẩn / hiện) do page bind sẵn; tham số bind đi qua client nên parse lại.
// Mọi action: câu đầu là assertAdmin (Server Action gọi thẳng được, không qua layout / proxy của /admin).

const COVER_BUCKET = 'book-covers'
const SNAPSHOT_COLUMNS =
  'id, slug, title, subtitle, isbn, language, category_id, price, stock, is_active, is_featured, cover_url, book_authors(author_id, role)'

type Supabase = Awaited<ReturnType<typeof createClient>>
type AuthorKey = { author_id: number; role: string }

const authorKey = ({ author_id, role }: AuthorKey) => `${author_id}:${role}`
const UNKNOWN: Failure = { ok: false, code: 'UNKNOWN' }
// Mục vừa bị xóa ở tab / máy khác (update khớp 0 dòng)
const ITEM_DELETED: Failure = { ok: false, code: 'ITEM_DELETED' }

/** Trạng thái hiện tại của sách (để làm mới đúng tag); lỗi DB và sách vừa bị xóa trả Failure riêng */
async function readSnapshot(supabase: Supabase, id: number) {
  const { data, error } = await supabase.from('books').select(SNAPSHOT_COLUMNS).eq('id', id).maybeSingle()
  if (error) {
    console.error('admin readSnapshot:', error.message)
    return toFailure(error)
  }
  if (!data) return ITEM_DELETED
  const { book_authors, cover_url, ...book } = data
  const snapshot: BookSnapshot = { ...book, authors: book_authors.map(authorKey) }
  return { snapshot, coverUrl: cover_url, bookAuthors: book_authors }
}

function expire(tags: string[]) {
  for (const tag of tags) updateTag(tag)
}

/** Lỗi ghi sách: slug / ISBN trùng (unique) → lỗi tại ô, còn lại → mã lỗi chung */
function bookWriteFailure(error: { code?: string; message: string }): Failure {
  const constraint = violatedUniqueConstraint(error)
  if (constraint === 'books_slug_key') return { ok: false, code: 'SLUG_TAKEN', fieldErrors: { slug: 'slugTaken' } }
  if (constraint === 'books_isbn_key') return { ok: false, code: 'INVALID_INPUT', fieldErrors: { isbn: 'isbnTaken' } }
  console.error('admin book write:', error.message)
  return toFailure(error)
}

/** Danh mục phải tồn tại và là danh mục lá (sách chỉ gắn vào danh mục lá) */
async function checkLeafCategory(supabase: Supabase, categoryId: number): Promise<Failure | null> {
  const [category, children] = await Promise.all([
    supabase.from('categories').select('id').eq('id', categoryId).maybeSingle(),
    supabase.from('categories').select('id', { count: 'exact', head: true }).eq('parent_id', categoryId),
  ])
  const queryError = category.error ?? children.error
  if (queryError) return toFailure(queryError)
  if (!category.data) return { ok: false, code: 'INVALID_INPUT', fieldErrors: { category_id: 'category' } }
  if ((children.count ?? 0) > 0) return { ok: false, code: 'INVALID_INPUT', fieldErrors: { category_id: 'categoryLeaf' } }
  return null
}

/**
 * Tác giả của sách: thêm dòng mới trước, xóa dòng bỏ đi sau (lỗi giữa chừng thì sách thừa tác giả chứ không mất hết).
 * Trigger book_authors_touch_book tính lại search_text.
 */
async function syncAuthors(supabase: Supabase, bookId: number, current: AuthorKey[], wanted: AuthorKey[]) {
  const currentKeys = new Set(current.map(authorKey))
  const wantedKeys = new Set(wanted.map(authorKey))
  const added = wanted.filter((row) => !currentKeys.has(authorKey(row)))
  const removed = current.filter((row) => !wantedKeys.has(authorKey(row)))

  if (added.length > 0) {
    const { error } = await supabase.from('book_authors').insert(added.map((row) => ({ ...row, book_id: bookId })))
    // 23503: tác giả vừa bị xóa ở tab khác
    if (error) return error.code === '23503' ? 'invalid' : 'error'
  }
  if (removed.length > 0) {
    // Giá trị là số và vai trò đã qua zod enum → an toàn để ghép vào bộ lọc or của PostgREST
    const filter = removed.map((row) => `and(author_id.eq.${row.author_id},role.eq.${row.role})`).join(',')
    const { error } = await supabase.from('book_authors').delete().eq('book_id', bookId).or(filter)
    if (error) return 'error'
  }
  return null
}

export async function updateBook(id: number, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const bookId = rowIdSchema.safeParse(id)
  if (!bookId.success) return UNKNOWN
  const parsed = bookFormSchema.safeParse(bookFormInput(formData))
  if (!parsed.success) return invalidInput(parsed.error)
  const { authors, ...fields } = parsed.data

  const supabase = await createClient()
  const [current, categoryFailure] = await Promise.all([
    readSnapshot(supabase, bookId.data),
    checkLeafCategory(supabase, fields.category_id),
  ])
  if ('ok' in current) return current
  if (categoryFailure) return categoryFailure

  const { data, error } = await supabase.from('books').update(fields).eq('id', bookId.data).select('id')
  if (error) return bookWriteFailure(error)
  if (data.length === 0) return ITEM_DELETED

  const authorsResult = await syncAuthors(supabase, bookId.data, current.bookAuthors, authors)
  if (authorsResult === 'invalid') return { ok: false, code: 'INVALID_INPUT', fieldErrors: { authors: 'invalid' } }

  // Thông tin sách đã lưu: làm mới cache kể cả khi đồng bộ tác giả lỗi (tác giả định đổi ≠ hiện có → có `books`)
  const before = current.snapshot
  const after: BookSnapshot = { ...before, ...fields, authors: authors.map(authorKey) }
  expire(adminCatalogTags({ kind: 'book', before, after }))
  refresh()
  // Thông tin sách đã lưu, chỉ bảng tác giả lỗi → nói rõ đã lưu một phần, bấm Lưu lại
  return authorsResult === null ? { ok: true, data: null } : { ok: false, code: 'BOOK_AUTHORS_NOT_SAVED' }
}

/** Ẩn / hiện sách (không xóa cứng: đơn cũ giữ liên kết, giỏ không bị xóa theo cascade) */
export async function setBookActive(id: number, active: boolean): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const bookId = rowIdSchema.safeParse(id)
  const isActive = bookActiveSchema.safeParse(active)
  if (!bookId.success || !isActive.success) return UNKNOWN

  const supabase = await createClient()
  const current = await readSnapshot(supabase, bookId.data)
  if ('ok' in current) return current

  const { data, error } = await supabase
    .from('books')
    .update({ is_active: isActive.data })
    .eq('id', bookId.data)
    .select('id')
  if (error) return toFailure(error)
  if (data.length === 0) return ITEM_DELETED

  const before = current.snapshot
  expire(adminCatalogTags({ kind: 'book', before, after: { ...before, is_active: isActive.data } }))
  refresh()
  return { ok: true, data: null }
}

/**
 * Upload bìa: kiểm tra cỡ trước khi đọc, kiểm tra loại bằng nội dung (sharp), thu về WebP 600px, lưu tên mới mỗi lần
 * (`<id>-<8 ký tự>.webp`: ảnh cũ đang được CDN / next/image cache 1 năm, ghi đè cùng tên thì người xem vẫn thấy bìa
 * cũ). Ghi cover_url xong mới xóa ảnh cũ (trong `after`, sau khi trả phản hồi); ghi lỗi thì xóa ảnh vừa upload.
 */
export async function uploadCover(id: number, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const bookId = rowIdSchema.safeParse(id)
  if (!bookId.success) return UNKNOWN

  const file = formData.get('cover')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, code: 'INVALID_INPUT', fieldErrors: { cover: 'coverRequired' } }
  }
  if (file.size > COVER_MAX_BYTES) return { ok: false, code: 'COVER_TOO_LARGE', fieldErrors: { cover: 'coverTooLarge' } }

  // Kiểm tra ảnh trước khi gọi DB: file sai báo lỗi ngay
  const webp = await toCoverWebp(Buffer.from(await file.arrayBuffer()))
  if (!webp) return { ok: false, code: 'COVER_INVALID', fieldErrors: { cover: 'coverInvalid' } }

  const supabase = await createClient()
  const current = await supabase.from('books').select('cover_url').eq('id', bookId.data).maybeSingle()
  if (current.error) return toFailure(current.error)
  if (!current.data) return ITEM_DELETED

  const storage = supabase.storage.from(COVER_BUCKET)
  const path = `${bookId.data}-${randomBytes(4).toString('hex')}.webp`
  const { error: uploadError } = await storage.upload(path, webp.data, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) {
    console.error('uploadCover (upload):', uploadError.message)
    return UNKNOWN
  }

  const { data, error } = await supabase
    .from('books')
    .update({ cover_url: storage.getPublicUrl(path).data.publicUrl, cover_width: webp.width })
    .eq('id', bookId.data)
    .select('id')
  if (error || data.length === 0) {
    const { error: cleanupError } = await storage.remove([path])
    if (cleanupError) console.error('uploadCover (cleanup):', cleanupError.message)
    return error ? toFailure(error) : ITEM_DELETED
  }

  // Dọn ảnh cũ sau khi đã trả phản hồi: bìa mới đã lưu, việc dọn chỉ tốn thêm 2 lượt gọi Supabase cho người dùng chờ
  const oldUrl = current.data.cover_url
  const publicBase = storage.getPublicUrl('').data.publicUrl
  after(() => removeOldCover(supabase, oldUrl, publicBase))
  expire([`book:${bookId.data}`])
  refresh()
  return { ok: true, data: null }
}

/**
 * Xóa ảnh bìa cũ nếu nằm trong bucket và không đơn nào còn dùng (order_items lưu bản sao cover_url lúc đặt: xóa thì
 * trang chi tiết đơn cũ mất ảnh). Lỗi chỉ ghi log: bìa mới đã lưu xong, ảnh cũ sót lại chỉ tốn chỗ.
 */
async function removeOldCover(supabase: Supabase, oldUrl: string | null, publicBase: string) {
  const oldPath = storageObjectPath(oldUrl, publicBase)
  if (!oldPath || !oldUrl) return
  const { count, error } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('cover_url', oldUrl)
  if (error || (count ?? 0) > 0) {
    if (error) console.error('uploadCover (order_items):', error.message)
    return
  }
  const { data, error: removeError } = await supabase.storage.from(COVER_BUCKET).remove([oldPath])
  if (removeError) console.error('uploadCover (remove old):', removeError.message)
  // Storage không báo lỗi khi phiên không đọc được object (thiếu policy select): trả về danh sách rỗng
  else if (data.length === 0) console.error('uploadCover (remove old): không xóa được', oldPath)
}
