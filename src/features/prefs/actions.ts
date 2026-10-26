'use server'

import { refresh } from 'next/cache'
import type { Locale } from 'next-intl'
import { parseLocale } from '@/features/auth/schemas'
import { getCurrentUser } from '@/lib/auth'
import { withMessage } from '@/lib/error-message'
import { toFailure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { blockMissingWarnings, confirmLimit, singleBlockResult } from './block-insert'
import { blockItemSchema, unblockItemSchema, type BlockItemInput, type UnblockItemInput } from './schemas'

// Chặn / bỏ chặn theo sở thích (docs/plans/so-thich-canh-bao.md, P-C). locale + mục do page bind sẵn (Server Action không
// đọc được next/root-params; tham số bind đi qua client nên parse lại). Ghi thẳng user_blocks bằng client theo phiên,
// quyền do RLS + quyền cột quyết định (insert: kind + cột đích, user_id = default auth.uid(); delete: dòng của chính
// mình). Không upsert / on_conflict: unique index một phần theo kind, PostgREST không suy được → trùng 23505 = đã chặn.
// Thành công → refresh(): <style> che thẻ ở [locale]/layout và trang hiện tại render lại theo mục chặn mới. Không
// updateTag catalog (dữ liệu chung không đổi).

// Lỗi trả kèm câu dịch sẵn (withMessage): PREFS_LIMIT có {max}, câu cần hỗ trợ có {email}.

export async function blockItem(locale: Locale, item: BlockItemInput): Promise<Result<null>> {
  const safeLocale = parseLocale(locale)
  const parsed = blockItemSchema.safeParse(item)
  if (!parsed.success) return withMessage(safeLocale, { ok: false, code: 'INVALID_INPUT' })
  const user = await getCurrentUser()
  if (!user) return withMessage(safeLocale, { ok: false, code: 'AUTH_REQUIRED' })

  const supabase = await createClient()
  const target = parsed.data
  let result: Result<null>
  if (target.kind === 'warnings') {
    // Nhãn server tự đọc từ sách (câu 7: mọi nhãn ĐÃ DUYỆT của cuốn đó), không tin client
    const { data: book, error } = await supabase
      .from('books')
      .select('content_warnings')
      .eq('id', target.bookId)
      .maybeSingle()
    if (error) return withMessage(safeLocale, toFailure(error))
    if (!book) return withMessage(safeLocale, { ok: false, code: 'ITEM_DELETED' })
    if (book.content_warnings.length === 0) return withMessage(safeLocale, { ok: false, code: 'INVALID_INPUT' })

    result = await blockMissingWarnings(
      book.content_warnings,
      async () => {
        const { data, error: readError } = await supabase
          .from('user_blocks')
          .select('warning')
          .eq('user_id', user.id)
          .eq('kind', 'warning')
        if (readError) return toFailure(readError)
        return { ok: true, data: data.flatMap((row) => (row.warning ? [row.warning] : [])) }
      },
      async (labels) => {
        const { error: insertError } = await supabase
          .from('user_blocks')
          .insert(labels.map((warning) => ({ kind: 'warning', warning })))
        return insertError
      },
    )
  } else {
    // Đúng một cột đích khác null, khớp kind (check user_blocks_target_check)
    const idFor = (kind: typeof target.kind) => (target.kind === kind ? target.id : null)
    const row = {
      kind: target.kind,
      category_id: idFor('category'),
      author_id: idFor('author'),
      publisher_id: idFor('publisher'),
    }
    const { error } = await supabase.from('user_blocks').insert(row)
    result = await confirmLimit(singleBlockResult(error), async () => {
      const { data: existing, error: readError } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('user_id', user.id)
        .eq('kind', target.kind)
        .eq(`${target.kind}_id`, target.id)
        .limit(1)
      return readError ?? existing.length > 0
    })
  }
  if (!result.ok) return withMessage(safeLocale, result)
  refresh()
  return result
}

export async function unblockItem(locale: Locale, item: UnblockItemInput): Promise<Result<null>> {
  const safeLocale = parseLocale(locale)
  const parsed = unblockItemSchema.safeParse(item)
  if (!parsed.success) return withMessage(safeLocale, { ok: false, code: 'INVALID_INPUT' })
  const user = await getCurrentUser()
  if (!user) return withMessage(safeLocale, { ok: false, code: 'AUTH_REQUIRED' })

  // 0 dòng (đã bỏ ở tab khác) → vẫn ok: kết quả người dùng muốn đã có
  const supabase = await createClient()
  const { error } = await supabase.from('user_blocks').delete().eq('id', parsed.data.id).eq('user_id', user.id)
  if (error) return withMessage(safeLocale, toFailure(error))
  refresh()
  return { ok: true, data: null }
}
