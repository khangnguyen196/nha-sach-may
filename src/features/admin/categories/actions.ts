'use server'

import { refresh, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { invalidInput, toFailure, type Failure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '../auth'
import { catalogTagsFor, type CategorySnapshot } from '../cache-tags'
import { violatedUniqueConstraint } from '../db-errors'
import { rowIdSchema } from '../schemas'
import { categoryFormSchema } from './schemas'

// id do page bind sẵn; tham số bind đi qua client nên parse lại. Câu đầu mọi action là assertAdmin.

type Supabase = Awaited<ReturnType<typeof createClient>>

const UNKNOWN: Failure = { ok: false, code: 'UNKNOWN' }

function categoryWriteFailure(error: { code?: string; message: string }): Failure {
  if (violatedUniqueConstraint(error) === 'categories_slug_key') {
    return { ok: false, code: 'SLUG_TAKEN', fieldErrors: { slug: 'slugTaken' } }
  }
  console.error('admin category write:', error.message)
  return toFailure(error)
}

/**
 * Danh mục tối đa 2 cấp, sách chỉ gắn vào danh mục lá:
 * - cha phải là danh mục gốc, khác chính nó;
 * - danh mục đang có con thì phải là gốc;
 * - danh mục đang có sách không làm cha được (sách của nó sẽ nằm ở danh mục không phải lá).
 */
async function checkParent(supabase: Supabase, selfId: number | null, parentId: number | null): Promise<Failure | null> {
  if (parentId === null) return null
  const depth: Failure = { ok: false, code: 'INVALID_INPUT', fieldErrors: { parent_id: 'categoryDepth' } }
  if (parentId === selfId) return depth

  const [parent, parentBooks, children] = await Promise.all([
    supabase.from('categories').select('parent_id').eq('id', parentId).maybeSingle(),
    supabase.from('books').select('id', { count: 'exact', head: true }).eq('category_id', parentId),
    selfId === null
      ? Promise.resolve({ count: 0, error: null })
      : supabase.from('categories').select('id', { count: 'exact', head: true }).eq('parent_id', selfId),
  ])
  if (parent.error || parentBooks.error || children.error) return UNKNOWN
  if (!parent.data || parent.data.parent_id !== null) return depth
  if ((children.count ?? 0) > 0) {
    return { ok: false, code: 'INVALID_INPUT', fieldErrors: { parent_id: 'categoryHasChildren' } }
  }
  if ((parentBooks.count ?? 0) > 0) {
    return { ok: false, code: 'CATEGORY_HAS_BOOKS', fieldErrors: { parent_id: 'categoryHasBooks' } }
  }
  return null
}

function expire(tags: string[]) {
  for (const tag of tags) updateTag(tag)
}

export async function createCategory(_prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const parsed = categoryFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const supabase = await createClient()
  const parentFailure = await checkParent(supabase, null, parsed.data.parent_id)
  if (parentFailure) return parentFailure

  const { error } = await supabase.from('categories').insert(parsed.data)
  if (error) return categoryWriteFailure(error)

  expire(catalogTagsFor({ kind: 'category', before: null, after: parsed.data }))
  redirect('/admin/danh-muc')
}

export async function updateCategory(id: number, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const categoryId = rowIdSchema.safeParse(id)
  if (!categoryId.success) return UNKNOWN
  const parsed = categoryFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const supabase = await createClient()
  const [current, parentFailure] = await Promise.all([
    supabase.from('categories').select('parent_id, is_active').eq('id', categoryId.data).maybeSingle(),
    checkParent(supabase, categoryId.data, parsed.data.parent_id),
  ])
  if (current.error || !current.data) return UNKNOWN
  if (parentFailure) return parentFailure

  const { data, error } = await supabase.from('categories').update(parsed.data).eq('id', categoryId.data).select('id')
  if (error) return categoryWriteFailure(error)
  if (data.length === 0) return UNKNOWN

  const before: CategorySnapshot = current.data
  expire(catalogTagsFor({ kind: 'category', before, after: parsed.data }))
  refresh()
  return { ok: true, data: null }
}
