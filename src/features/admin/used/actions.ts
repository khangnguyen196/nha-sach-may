'use server'

import { refresh, updateTag } from 'next/cache'
import { getFormatter, getTranslations } from 'next-intl/server'
import { usedListingTags } from '@/features/used/tags'
import { withMessage } from '@/lib/error-message'
import { invalidInput, toFailure, type Failure, type FieldErrors, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '../auth'
import { rejectReasonSchema, reviewTargetSchema } from './schemas'

// Admin duyệt / từ chối / gỡ tin sách cũ qua RPC review_used_listing (kiểm is_admin, khóa dòng, so trạng thái đang
// hiển thị, kiểm lại sách + giá trần + ảnh khi duyệt). id do page bind; trạng thái đang hiển thị gửi qua ô ẩn
// `expected_status`. Câu đầu mọi action là assertAdmin (Server Action gọi thẳng được bằng action ID).

const UNKNOWN: Failure = { ok: false, code: 'UNKNOWN' }
const STATUS_CHANGED: Failure = { ok: false, code: 'LISTING_STATUS_CHANGED' }
const REASON_ERROR: FieldErrors = { reason: 'listingRejectReason' }

type Supabase = Awaited<ReturnType<typeof createClient>>

function parseTarget(id: number, formData: FormData) {
  return reviewTargetSchema.safeParse({ id, expected_status: formData.get('expected_status') })
}

/** book_id của tin (tag "Có N bản cũ" của trang sách); tin không còn → null */
async function listingBookId(supabase: Supabase, id: number) {
  const { data, error } = await supabase.from('used_listings').select('book_id').eq('id', id).maybeSingle()
  if (error) return toFailure(error)
  return data?.book_id ?? null
}

/**
 * Lỗi RPC → Result của form admin. Trạng thái vừa đổi / chuyển không hợp lệ: refresh() để trang hiện trạng thái thật.
 * Giá vượt trần khi duyệt: câu riêng cho admin (câu của người bán bảo "sửa giá"); sách ngừng bán: câu kèm tên sách.
 */
async function reviewFailure(error: { message: string; details?: string | null; code?: string | null }): Promise<Failure> {
  const failure = toFailure(error)
  switch (failure.code) {
    case 'LISTING_STATUS_CHANGED':
    case 'LISTING_INVALID_TRANSITION':
      refresh()
      return failure
    case 'LISTING_PRICE_INVALID': {
      const max = failure.details?.max
      if (typeof max !== 'number') return failure
      const [t, format] = await Promise.all([
        getTranslations({ locale: 'vi', namespace: 'admin.usedListings' }),
        getFormatter({ locale: 'vi' }),
      ])
      return { ...failure, message: t('priceTooHigh', { max: format.number(max, 'price') }) }
    }
    case 'BOOK_UNAVAILABLE':
      return withMessage('vi', failure)
    case 'INVALID_INPUT':
      return failure.details?.field === 'reason' ? { ...failure, fieldErrors: REASON_ERROR } : failure
    default:
      return failure
  }
}

/** Tin đổi trạng thái (lên / khỏi chợ) → làm mới chợ, trang tin, "Có N bản cũ" của sách; trang admin render lại */
function expire(id: number, bookId: number) {
  for (const tag of usedListingTags(id, bookId)) updateTag(tag)
  refresh()
}

/** Duyệt tin chờ duyệt → hiện công khai (RPC kiểm lại sách đang bán, giá ≤ giá gốc hiện tại, ảnh còn đủ) */
export async function approveListing(id: number, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const target = parseTarget(id, formData)
  if (!target.success) return UNKNOWN

  const supabase = await createClient()
  const bookId = await listingBookId(supabase, target.data.id)
  if (bookId === null) {
    refresh()
    return STATUS_CHANGED
  }
  if (typeof bookId !== 'number') return bookId

  const { error } = await supabase.rpc('review_used_listing', {
    p_id: target.data.id,
    p_expected_status: target.data.expected_status,
    p_approve: true,
  })
  if (error) return reviewFailure(error)
  expire(target.data.id, bookId)
  return { ok: true, data: null }
}

/**
 * Từ chối tin chờ duyệt, hoặc gỡ tin đang bán (expected_status = approved), bắt buộc lý do. Lý do sai → lỗi dưới ô lý
 * do, chữ đã gõ còn nguyên (form không reset).
 */
export async function rejectListing(id: number, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const target = parseTarget(id, formData)
  if (!target.success) return UNKNOWN
  const parsed = rejectReasonSchema.safeParse({ reason: formData.get('reason') ?? undefined })
  if (!parsed.success) return invalidInput(parsed.error)

  const supabase = await createClient()
  const bookId = await listingBookId(supabase, target.data.id)
  if (bookId === null) {
    refresh()
    return STATUS_CHANGED
  }
  if (typeof bookId !== 'number') return bookId

  const { error } = await supabase.rpc('review_used_listing', {
    p_id: target.data.id,
    p_expected_status: target.data.expected_status,
    p_approve: false,
    p_reason: parsed.data.reason,
  })
  if (error) return reviewFailure(error)
  expire(target.data.id, bookId)
  return { ok: true, data: null }
}
