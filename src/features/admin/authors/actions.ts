'use server'

import { refresh, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { invalidInput, toFailure, type Failure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '../auth'
import { catalogTagsFor } from '../cache-tags'
import { violatedUniqueConstraint } from '../db-errors'
import { rowIdSchema } from '../schemas'
import { authorFormSchema } from './schemas'

// id do page bind sẵn; tham số bind đi qua client nên parse lại. Câu đầu mọi action là assertAdmin.

const UNKNOWN: Failure = { ok: false, code: 'UNKNOWN' }

function authorWriteFailure(error: { code?: string; message: string }): Failure {
  if (violatedUniqueConstraint(error) === 'authors_slug_key') {
    return { ok: false, code: 'SLUG_TAKEN', fieldErrors: { slug: 'slugTaken' } }
  }
  console.error('admin author write:', error.message)
  return toFailure(error)
}

function expire(tags: string[]) {
  for (const tag of tags) updateTag(tag)
}

export async function createAuthor(_prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const parsed = authorFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.from('authors').insert(parsed.data)
  if (error) return authorWriteFailure(error)

  expire(catalogTagsFor({ kind: 'author', bookIds: [] }))
  redirect('/admin/tac-gia')
}

/** Tên tác giả hiện trên thẻ sách → làm mới cả các sách của tác giả (trigger authors_touch_books lo search_text) */
export async function updateAuthor(id: number, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const authorId = rowIdSchema.safeParse(id)
  if (!authorId.success) return UNKNOWN
  const parsed = authorFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('authors')
    .update(parsed.data)
    .eq('id', authorId.data)
    .select('book_authors(book_id)')
  if (error) return authorWriteFailure(error)
  const [author] = data
  if (!author) return UNKNOWN

  const bookIds = [...new Set(author.book_authors.map((row) => row.book_id))]
  expire(catalogTagsFor({ kind: 'author', bookIds }))
  refresh()
  return { ok: true, data: null }
}

/**
 * Chỉ xóa khi không còn sách: book_authors xóa theo cascade, sách sẽ mất tác giả mà không ai hay.
 * Đếm rồi xóa không nằm trong một transaction: sách được gắn đúng lúc đó thì mất liên kết (admin một người, chấp nhận).
 */
export async function deleteAuthor(id: number): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const authorId = rowIdSchema.safeParse(id)
  if (!authorId.success) return UNKNOWN

  const supabase = await createClient()
  const { count, error: countError } = await supabase
    .from('book_authors')
    .select('book_id', { count: 'exact', head: true })
    .eq('author_id', authorId.data)
  if (countError) return toFailure(countError)
  if ((count ?? 0) > 0) return { ok: false, code: 'AUTHOR_HAS_BOOKS' }

  const { error } = await supabase.from('authors').delete().eq('id', authorId.data)
  if (error) return toFailure(error)

  expire(catalogTagsFor({ kind: 'author', bookIds: [] }))
  redirect('/admin/tac-gia')
}
