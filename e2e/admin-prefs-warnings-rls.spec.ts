import { expect, test } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadLocalSupabase } from '../scripts/e2e-env'
import {
  anonClient,
  bookWarnings,
  cleanupE2eAdminData,
  createE2eAuthors,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  makeAdmin,
  replaceUserBlocks,
  signedInClient,
  userBlocksOf,
  warningSuggestionRow,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import type { Database } from '../src/types/database'

// Cảnh báo nội dung + chặn theo sở thích phần A (docs/plans/so-thich-canh-bao.md, schema.sql mục 16): chỉ DB, không UI.
// Gọi thẳng PostgREST bằng supabase-js theo phiên từng người (admin A, thành viên U, V, khách chưa đăng nhập): trigger
// thời điểm xét, RLS + quyền cột của user_blocks / content_warning_suggestions, giới hạn 50 mục, 2 RPC chỉ admin.
// admin-*.spec.ts → chỉ chạy ở desktop-admin: lượt consume_warning_quota hợp lệ (cộng vào bucket chung gemini:* của
// chatbot) một lần mỗi lần chạy nhóm (≤ 3 khi CI retry cả nhóm serial). User + sách + tác giả tạo riêng mỗi lần chạy,
// xóa ở afterAll.

test.describe.configure({ mode: 'serial' })

type Client = ReturnType<typeof anonClient>
type Warning = Database['public']['Enums']['content_warning']
type Functions = Database['public']['Functions']
type ReviewFn = Functions['review_warning_suggestion']
type QuotaFn = Functions['consume_warning_quota']
type BooksTable = Database['public']['Tables']['books']
/**
 * Kiểu CLI sinh cho tham số hàm không bao giờ nullable. p_expected_reviewed_at có `default null` trong SQL → CLI sinh
 * `?: string` (types trước đổi chữ ký: `: string`); bản nới `?: string | null` compile được với cả hai và cho ca bỏ
 * khóa / gửi null tường minh. Nới riêng: review_warning_suggestion nhận null ở p_labels / p_expected_reviewed_at,
 * consume_warning_quota nhận p_limits bất kỳ (ca tham số sai), books.content_warnings nhận phần tử null (ca 23514);
 * phần còn lại giữ nguyên kiểu Database.
 */
type LooseDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions' | 'Tables'> & {
    Tables: Omit<Database['public']['Tables'], 'books'> & {
      books: Omit<BooksTable, 'Update'> & {
        Update: Omit<BooksTable['Update'], 'content_warnings'> & { content_warnings?: (Warning | null)[] }
      }
    }
    Functions: Omit<Functions, 'review_warning_suggestion' | 'consume_warning_quota'> & {
      review_warning_suggestion: Omit<ReviewFn, 'Args'> & {
        Args: Omit<ReviewFn['Args'], 'p_labels' | 'p_expected_reviewed_at'> & {
          p_labels: Warning[] | null
          p_expected_reviewed_at?: string | null
        }
      }
      consume_warning_quota: Omit<QuotaFn, 'Args'> & { Args: { p_limits: unknown } }
    }
  }
}

const PREFS_LIMIT = 50
const WARNINGS: Warning[] = ['violence', 'loss', 'self_harm', 'adult', 'other_sensitive']
// Lượt hợp lệ: trần phút 100000 vì gemini:minute dùng chung với spec chatbot chạy song song (trần nhỏ → đỏ ngẫu nhiên);
// trần ngày 60 = trần cứng của SQL (không chạm: mỗi lần chạy nhóm một lượt hợp lệ)
const VALID_LIMITS = { geminiCallsPerMinute: 100_000, warnCallsPerMinute: 100_000, warnCallsPerDay: 60 }

let admin: E2eUser
let member: E2eUser
let other: E2eUser
let adminClient: Client
let memberClient: Client
let otherClient: Client
let anon: Client
/** Cùng phiên admin A, kiểu LooseDatabase: chỉ cho lời gọi bỏ khóa / gửi null / tham số sai kiểu */
let adminLoose: SupabaseClient<LooseDatabase>
let categoryId: number
let authorIds: number[]
let triggerBook: E2eAdminBook
let suggestionBook: E2eAdminBook
let reviewBook: E2eAdminBook
/** Gợi ý chờ duyệt của suggestionBook: ca (d) tạo, ca RPC chỉ admin dùng lại, ca bỏ khóa duyệt nó */
let pendingSuggestionId: number
const slugs: string[] = []

test.beforeAll(async () => {
  test.setTimeout(60_000)
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  categoryId = leaf.id
  ;[triggerBook, suggestionBook, reviewBook] = await Promise.all([
    createE2eBook({ categoryId: leaf.id }),
    createE2eBook({ categoryId: leaf.id }),
    createE2eBook({ categoryId: leaf.id }),
  ])
  slugs.push(triggerBook.slug, suggestionBook.slug, reviewBook.slug)
  // 45 tác giả cho 50 mục nạp sẵn (cùng 5 nhãn) + 1 tác giả cho mục thứ 51
  const authors = await createE2eAuthors(PREFS_LIMIT - WARNINGS.length + 1)
  slugs.push(...authors.map((author) => author.slug))
  authorIds = authors.map((author) => author.id)

  ;[admin, member, other] = await Promise.all([
    createE2eUser('prefs-admin'),
    createE2eUser('prefs-member'),
    createE2eUser('prefs-other'),
  ])
  await makeAdmin(admin.id)
  anon = anonClient()
  ;[adminClient, memberClient, otherClient] = await Promise.all([
    signedInClient(admin),
    signedInClient(member),
    signedInClient(other),
  ])
  const { url, publishableKey } = loadLocalSupabase()
  adminLoose = createClient<LooseDatabase>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error } = await adminLoose.auth.signInWithPassword({ email: admin.email, password: admin.password })
  if (error) throw new Error(`signInWithPassword (admin, kiểu nới): ${error.message}`)
})

test.afterAll(async () => {
  // user_blocks xóa theo cascade của profiles; gợi ý cảnh báo theo cascade của sách
  const users = [admin, member, other].filter((user) => user !== undefined)
  await deleteE2eUsers(users.map((user) => user.id))
  await cleanupE2eAdminData(slugs)
})

/** Admin sửa nhãn sách như form admin (không gửi reviewed_at); đúng 1 dòng đổi */
async function setWarnings(bookId: number, labels: Warning[]) {
  const { data, error } = await adminClient
    .from('books')
    .update({ content_warnings: labels })
    .eq('id', bookId)
    .select('id')
  expect(error).toBeNull()
  expect(data).toHaveLength(1)
}

/** Thời điểm xét (chuỗi PostgREST nguyên văn, gửi lại RPC không qua Date); sách chưa xét → throw */
function reviewedAt(row: { content_warnings_reviewed_at: string | null }) {
  if (row.content_warnings_reviewed_at === null) throw new Error('Sách chưa có thời điểm xét')
  return row.content_warnings_reviewed_at
}

/** Gợi ý pending mới của admin A cho sách; trả id */
async function suggest(bookId: number, labels: Warning[]) {
  const { data, error } = await adminClient
    .from('content_warning_suggestions')
    .insert({ book_id: bookId, labels, reason: 'Gợi ý e2e.', model: 'e2e-mock' })
    .select('id, status')
    .single()
  if (error) throw new Error(`suggest: ${error.message}`)
  expect(data.status).toBe('pending')
  return data.id
}

test('(a) trigger: nhãn bỏ trùng + xếp theo enum, tự ghi thời điểm xét; xóa thời điểm của sách có nhãn → 23514', async () => {
  expect(await bookWarnings(triggerBook.id)).toEqual({ content_warnings: [], content_warnings_reviewed_at: null })

  await setWarnings(triggerBook.id, ['adult', 'violence', 'violence'])
  const first = await bookWarnings(triggerBook.id)
  expect(first.content_warnings).toEqual(['violence', 'adult'])
  expect(first.content_warnings_reviewed_at).not.toBeNull()

  // Cùng bộ nhãn, khác thứ tự: chuẩn hóa trước khi so → không tính là đổi
  await setWarnings(triggerBook.id, ['adult', 'violence'])
  expect(await bookWarnings(triggerBook.id)).toEqual(first)

  // Nhãn khác, request (transaction) sau → now() khác; chỉ so khác, không so lớn hơn (comment của trigger)
  await setWarnings(triggerBook.id, ['loss'])
  const second = await bookWarnings(triggerBook.id)
  expect(second.content_warnings).toEqual(['loss'])
  expect(second.content_warnings_reviewed_at).not.toBeNull()
  expect(second.content_warnings_reviewed_at).not.toBe(first.content_warnings_reviewed_at)

  const clear = await adminClient
    .from('books')
    .update({ content_warnings_reviewed_at: null })
    .eq('id', triggerBook.id)
  expect(clear.error?.code).toBe('23514')
  expect(await bookWarnings(triggerBook.id)).toEqual(second)

  // Nhãn có phần tử null: trigger chuẩn hóa giữ null (array_agg) → check books_content_warnings_check
  const withNull = await adminLoose
    .from('books')
    .update({ content_warnings: ['violence', null] })
    .eq('id', triggerBook.id)
  expect(withNull.error?.code).toBe('23514')
  expect(await bookWarnings(triggerBook.id)).toEqual(second)

  // Thành viên: có quyền cột (grant cho authenticated) nhưng RLS books_admin_update lọc hết dòng → 0 dòng, không lỗi
  const byMember = await memberClient
    .from('books')
    .update({ content_warnings: ['violence'] })
    .eq('id', triggerBook.id)
    .select('id')
  expect(byMember.error).toBeNull()
  expect(byMember.data).toEqual([])
  expect(await bookWarnings(triggerBook.id)).toEqual(second)

  // Cột công khai: khách chưa đăng nhập đọc được nhãn
  const publicRow = await anon.from('books').select('content_warnings').eq('id', triggerBook.id).single()
  expect(publicRow.error).toBeNull()
  expect(publicRow.data?.content_warnings).toEqual(['loss'])
})

test('(b) user_blocks: thêm của chính mình; không gửi user_id, không trùng, kind khớp cột đích, không update; không xóa được mục của người khác', async () => {
  const added = await memberClient
    .from('user_blocks')
    .insert({ kind: 'category', category_id: categoryId })
    .select('id, user_id')
    .single()
  expect(added.error).toBeNull()
  expect(added.data?.user_id).toBe(member.id)

  const withUserId = await memberClient
    .from('user_blocks')
    .insert({ kind: 'category', category_id: categoryId, user_id: member.id })
  expect(withUserId.error?.code).toBe('42501')

  const duplicate = await memberClient.from('user_blocks').insert({ kind: 'category', category_id: categoryId })
  expect(duplicate.error?.code).toBe('23505')

  const mismatch = await memberClient.from('user_blocks').insert({ kind: 'author', category_id: categoryId })
  expect(mismatch.error?.code).toBe('23514')

  const update = await memberClient.from('user_blocks').update({ kind: 'warning' }).eq('user_id', member.id)
  expect(update.error?.code).toBe('42501')
  expect(update.error?.message).toMatch(/permission denied/)

  const otherRow = await otherClient
    .from('user_blocks')
    .insert({ kind: 'warning', warning: 'loss' })
    .select('id')
    .single()
  if (otherRow.error) throw new Error(`user_blocks (V): ${otherRow.error.message}`)
  const removed = await memberClient.from('user_blocks').delete().eq('id', otherRow.data.id).select('id')
  expect(removed.error).toBeNull()
  expect(removed.data).toEqual([])
  expect((await userBlocksOf(other.id)).map((row) => row.id)).toEqual([otherRow.data.id])
  expect(await userBlocksOf(member.id)).toHaveLength(1)
})

test('(b) giới hạn 50 mục / tài khoản: mục thứ 51 → PREFS_LIMIT {"max": 50}', async () => {
  const fill = PREFS_LIMIT - WARNINGS.length
  await replaceUserBlocks(member.id, [
    ...WARNINGS.map((warning) => ({ kind: 'warning', warning })),
    ...authorIds.slice(0, fill).map((authorId) => ({ kind: 'author', author_id: authorId })),
  ])
  expect(await userBlocksOf(member.id)).toHaveLength(PREFS_LIMIT)

  const extra = authorIds[fill]
  if (extra === undefined) throw new Error('Thiếu tác giả test cho mục thứ 51')
  const { error } = await memberClient.from('user_blocks').insert({ kind: 'author', author_id: extra })
  expect(error?.message).toBe('PREFS_LIMIT')
  expect(JSON.parse(error?.details ?? '{}')).toEqual({ max: PREFS_LIMIT })
  expect(await userBlocksOf(member.id)).toHaveLength(PREFS_LIMIT)
})

test('(c) danh sách chặn: thành viên khác, admin đều không đọc được; khách chưa đăng nhập bị từ chối', async () => {
  // Dòng của V có thật (không thì "0 dòng" bên dưới đạt giả)
  expect(await userBlocksOf(other.id)).toHaveLength(1)

  const byMember = await memberClient.from('user_blocks').select('id').eq('user_id', other.id)
  expect(byMember.error).toBeNull()
  expect(byMember.data).toEqual([])

  const byAdmin = await adminClient.from('user_blocks').select('id').eq('user_id', other.id)
  expect(byAdmin.error).toBeNull()
  expect(byAdmin.data).toEqual([])

  const byAnon = await anon.from('user_blocks').select('id').eq('user_id', other.id)
  expect(byAnon.error?.code).toBe('42501')
})

test('(d) content_warning_suggestions: chỉ admin thêm / đọc, không gửi status, một gợi ý chờ duyệt / sách, không sửa / xóa', async () => {
  const id = await suggest(suggestionBook.id, ['adult', 'loss'])
  pendingSuggestionId = id
  expect(await warningSuggestionRow(id)).toMatchObject({ labels: ['loss', 'adult'], status: 'pending', reviewed_at: null })

  const withStatus = await adminClient
    .from('content_warning_suggestions')
    .insert({ book_id: suggestionBook.id, labels: [], reason: 'x', status: 'approved' })
  expect(withStatus.error?.code).toBe('42501')

  const secondPending = await adminClient
    .from('content_warning_suggestions')
    .insert({ book_id: suggestionBook.id, labels: ['loss'], reason: 'Gợi ý thứ hai.' })
  expect(secondPending.error?.code).toBe('23505')

  const update = await adminClient.from('content_warning_suggestions').update({ reason: 'sửa' }).eq('id', id)
  expect(update.error?.code).toBe('42501')
  const remove = await adminClient.from('content_warning_suggestions').delete().eq('id', id)
  expect(remove.error?.code).toBe('42501')
  expect(await warningSuggestionRow(id)).toMatchObject({ status: 'pending' })

  const memberInsert = await memberClient
    .from('content_warning_suggestions')
    .insert({ book_id: suggestionBook.id, labels: [], reason: 'x' })
  expect(memberInsert.error?.code).toBe('42501')
  expect(memberInsert.error?.message).toMatch(/row-level security/)
  const memberSelect = await memberClient.from('content_warning_suggestions').select('id').eq('id', id)
  expect(memberSelect.error).toBeNull()
  expect(memberSelect.data).toEqual([])

  const anonSelect = await anon.from('content_warning_suggestions').select('id').eq('id', id)
  expect(anonSelect.error?.code).toBe('42501')
  const anonInsert = await anon
    .from('content_warning_suggestions')
    .insert({ book_id: suggestionBook.id, labels: [], reason: 'x' })
  expect(anonInsert.error?.code).toBe('42501')
})

test('(e) RPC chỉ admin: khách chưa đăng nhập không gọi được, thành viên → FORBIDDEN', async () => {
  const labels: Warning[] = ['violence']
  const reviewArgs = {
    p_id: pendingSuggestionId,
    p_labels: labels,
    p_approve: true,
    p_expected_reviewed_at: '2000-01-01T00:00:00+00:00',
  }

  const anonQuota = await anon.rpc('consume_warning_quota', { p_limits: VALID_LIMITS })
  expect(anonQuota.error?.code).toBe('42501')
  const anonReview = await anon.rpc('review_warning_suggestion', reviewArgs)
  expect(anonReview.error?.code).toBe('42501')

  const memberQuota = await memberClient.rpc('consume_warning_quota', { p_limits: VALID_LIMITS })
  expect(memberQuota.error?.message).toBe('FORBIDDEN')
  const memberReview = await memberClient.rpc('review_warning_suggestion', reviewArgs)
  expect(memberReview.error?.message).toBe('FORBIDDEN')
  expect(await warningSuggestionRow(pendingSuggestionId)).toMatchObject({ status: 'pending' })
  expect(await bookWarnings(suggestionBook.id)).toEqual({ content_warnings: [], content_warnings_reviewed_at: null })
})

test('(e) review_warning_suggestion bỏ khóa p_expected_reviewed_at: sách chưa xét → duyệt được; sách đã xét → SUGGESTION_STATUS_CHANGED', async () => {
  // (i) Gợi ý pending của (d) trên suggestionBook, sách chưa xét: không gửi khóa = null (default của SQL)
  expect(await bookWarnings(suggestionBook.id)).toEqual({ content_warnings: [], content_warnings_reviewed_at: null })
  const approved = await adminLoose.rpc('review_warning_suggestion', {
    p_id: pendingSuggestionId,
    p_labels: ['adult', 'violence', 'adult'],
    p_approve: true,
  })
  expect(approved.error).toBeNull()
  expect(approved.data).toBe(suggestionBook.id)
  const afterApprove = await bookWarnings(suggestionBook.id)
  expect(afterApprove.content_warnings).toEqual(['violence', 'adult'])
  expect(afterApprove.content_warnings_reviewed_at).not.toBeNull()
  expect(await warningSuggestionRow(pendingSuggestionId)).toMatchObject({
    status: 'approved',
    labels: ['violence', 'adult'],
  })

  // (ii) Sách đã xét: quên gửi khóa (null ≠ thời điểm xét) → không ghi đè, gợi ý vẫn pending
  const next = await suggest(suggestionBook.id, ['loss'])
  for (const approve of [true, false]) {
    const forgot = await adminLoose.rpc('review_warning_suggestion', {
      p_id: next,
      p_labels: ['loss'],
      p_approve: approve,
    })
    expect(forgot.error?.message, `p_approve = ${approve}`).toBe('SUGGESTION_STATUS_CHANGED')
  }
  expect(await bookWarnings(suggestionBook.id)).toEqual(afterApprove)
  expect(await warningSuggestionRow(next)).toMatchObject({ status: 'pending', reviewed_at: null })
})

test('(e) review_warning_suggestion: duyệt sách chưa xét, thời điểm xét lệch → SUGGESTION_STATUS_CHANGED, bỏ qua', async () => {
  const first = await suggest(reviewBook.id, ['violence'])
  expect(await bookWarnings(reviewBook.id)).toEqual({ content_warnings: [], content_warnings_reviewed_at: null })

  // Sách chưa xét: p_expected_reviewed_at = null; nhãn admin sửa (lặp, sai thứ tự) được chuẩn hóa
  const approved = await adminLoose.rpc('review_warning_suggestion', {
    p_id: first,
    p_labels: ['self_harm', 'loss', 'loss'],
    p_approve: true,
    p_expected_reviewed_at: null,
  })
  expect(approved.error).toBeNull()
  expect(approved.data).toBe(reviewBook.id)
  const afterApprove = await bookWarnings(reviewBook.id)
  expect(afterApprove.content_warnings).toEqual(['loss', 'self_harm'])
  const oldReviewedAt = reviewedAt(afterApprove)
  expect(await warningSuggestionRow(first)).toMatchObject({ status: 'approved', labels: ['loss', 'self_harm'] })

  // Gợi ý đã duyệt không duyệt lại được
  const again = await adminClient.rpc('review_warning_suggestion', {
    p_id: first,
    p_labels: ['adult'],
    p_approve: true,
    p_expected_reviewed_at: oldReviewedAt,
  })
  expect(again.error?.message).toBe('SUGGESTION_STATUS_CHANGED')

  // Admin mở gợi ý mới (thời điểm xét lúc mở = oldReviewedAt), trong lúc đó nhãn bị sửa tay ở form sách
  const second = await suggest(reviewBook.id, ['violence'])
  await setWarnings(reviewBook.id, ['adult'])
  const manual = await bookWarnings(reviewBook.id)
  expect(manual.content_warnings).toEqual(['adult'])
  expect(manual.content_warnings_reviewed_at).not.toBe(oldReviewedAt)

  const stale = await adminClient.rpc('review_warning_suggestion', {
    p_id: second,
    p_labels: ['violence'],
    p_approve: true,
    p_expected_reviewed_at: oldReviewedAt,
  })
  expect(stale.error?.message).toBe('SUGGESTION_STATUS_CHANGED')
  expect(await bookWarnings(reviewBook.id)).toEqual(manual)
  expect(await warningSuggestionRow(second)).toMatchObject({ status: 'pending', reviewed_at: null })

  const manualReviewedAt = reviewedAt(manual)
  // Duyệt mà không có nhãn → INVALID_INPUT (trước khi khóa / so gì)
  const noLabels = await adminLoose.rpc('review_warning_suggestion', {
    p_id: second,
    p_labels: null,
    p_approve: true,
    p_expected_reviewed_at: manualReviewedAt,
  })
  expect(noLabels.error?.message).toBe('INVALID_INPUT')
  // Bỏ qua cũng so thời điểm xét: giá trị cũ → SUGGESTION_STATUS_CHANGED
  const staleDismiss = await adminClient.rpc('review_warning_suggestion', {
    p_id: second,
    p_labels: [],
    p_approve: false,
    p_expected_reviewed_at: oldReviewedAt,
  })
  expect(staleDismiss.error?.message).toBe('SUGGESTION_STATUS_CHANGED')
  expect(await warningSuggestionRow(second)).toMatchObject({ status: 'pending' })

  // Đổi tồn kho (đổi updated_at, như đặt / hủy đơn) không làm gợi ý báo lệch: RPC chỉ so thời điểm xét
  const before = await adminClient.from('books').select('updated_at').eq('id', reviewBook.id).single()
  if (before.error) throw new Error(`updated_at: ${before.error.message}`)
  const restock = await adminClient
    .from('books')
    .update({ stock: 7 })
    .eq('id', reviewBook.id)
    .select('updated_at')
    .single()
  expect(restock.error).toBeNull()
  // updated_at đổi thật (trigger books_updated_at), không thì ca này đạt giả
  expect(restock.data?.updated_at).not.toBe(before.data.updated_at)
  expect(await bookWarnings(reviewBook.id)).toEqual(manual)

  // Bỏ qua với thời điểm xét đúng: gợi ý dismissed, nhãn sách giữ bản sửa tay (p_labels bị bỏ qua)
  const dismissed = await adminClient.rpc('review_warning_suggestion', {
    p_id: second,
    p_labels: ['violence'],
    p_approve: false,
    p_expected_reviewed_at: manualReviewedAt,
  })
  expect(dismissed.error).toBeNull()
  expect(dismissed.data).toBe(reviewBook.id)
  const afterDismiss = await bookWarnings(reviewBook.id)
  expect(afterDismiss.content_warnings).toEqual(['adult'])
  expect(afterDismiss.content_warnings_reviewed_at).not.toBeNull()
  expect(afterDismiss.content_warnings_reviewed_at).not.toBe(manualReviewedAt)
  const dismissedRow = await warningSuggestionRow(second)
  expect(dismissedRow).toMatchObject({ status: 'dismissed', labels: ['violence'] })
  expect(dismissedRow?.reviewed_at).not.toBeNull()
})

test('(e) consume_warning_quota: tham số sai → INVALID_INPUT; một lượt hợp lệ của admin → ok', async () => {
  const consume = async (limits: unknown) => {
    const { data, error } = await adminLoose.rpc('consume_warning_quota', { p_limits: limits })
    return error ? { code: error.message, details: error.details } : { code: 'ok', data }
  }
  const invalid: [unknown, { field: string; max: number }][] = [
    [{ ...VALID_LIMITS, warnCallsPerDay: 61 }, { field: 'warnCallsPerDay', max: 60 }],
    [{ warnCallsPerMinute: 100_000, warnCallsPerDay: 60 }, { field: 'geminiCallsPerMinute', max: 100_000 }],
    [{ ...VALID_LIMITS, warnCallsPerDay: '30' }, { field: 'warnCallsPerDay', max: 60 }],
    ['{"geminiCallsPerMinute":1}', { field: 'geminiCallsPerMinute', max: 100_000 }],
  ]
  for (const [limits, detail] of invalid) {
    const result = await consume(limits)
    expect(result.code, JSON.stringify(limits)).toBe('INVALID_INPUT')
    expect(JSON.parse(result.details ?? '{}'), JSON.stringify(limits)).toEqual(detail)
  }

  // private.chat_quota không lộ qua PostgREST (kể cả service role) → không đọc trước được gemini:day / warn:day; bị chặn
  // thì báo rõ phạm vi thay vì một lỗi chung
  const valid = await adminClient.rpc('consume_warning_quota', { p_limits: VALID_LIMITS })
  if (valid.error?.message === 'WARNING_QUOTA_EXCEEDED') {
    throw new Error(
      `consume_warning_quota bị chặn (${valid.error.details}): bộ đếm của DB CI đã chạm trần (chat_reserve: ` +
        'gemini:day ≥ 300 do spec chatbot; warn_day: các spec gợi ý cảnh báo đã dùng hết 60 lượt), xem lại bất biến ' +
        'tổng lượt Gemini trong docs/plans/so-thich-canh-bao.md',
    )
  }
  expect(valid.error).toBeNull()
  expect(valid.data).toEqual({ ok: true })
})
