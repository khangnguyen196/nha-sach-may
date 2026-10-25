import { expect, type Locator, type Page } from '@playwright/test'
import {
  bookWarnings,
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  deleteWarningSuggestions,
  insertWarningSuggestion,
  maxWarningSuggestionId,
  unreviewedBooksWithoutPending,
  warningSuggestionRow,
  warningSuggestionsAfter,
  warningSuggestionsOf,
} from '../scripts/e2e-user'
import { WARNING_LIMITS } from '../src/features/chat/config'
import { adminTest as test, main, openBookEditor, saveBook } from './admin'
import { NO_SESSION } from './auth'
import { collectErrors, waitForHydration, waitForSettled } from './helpers'

// Cảnh báo nội dung P-B (docs/plans/so-thich-canh-bao.md): admin gợi ý bằng AI giả (CHAT_AI_MOCK, cụm [mock:warn-…] trong
// tên sách, không bao giờ gọi Gemini thật) → sửa → duyệt / bỏ qua → khung cảnh báo ở trang sách của khách.
// admin-*.spec.ts → chỉ desktop-admin. Mỗi test một sách e2e-admin riêng (hết cooldown theo lô của AI giả khi retry),
// dọn ở finally đúng slug của mình (gợi ý của sách xóa theo: on delete cascade). Số lượt consume_warning_quota hợp lệ
// (`suggestOne` / `startBatch`) khai báo ở e2e/gemini-budget.ts, Vitest kiểm bất biến hạn mức ngày.

// Mỗi test đi qua nhiều trang (trang sửa sách, /admin/canh-bao, trang sách vi / en của khách) + một / hai lượt AI giả
test.describe.configure({ timeout: 60_000 })

const NOTICE = { vi: 'Lưu ý về nội dung', en: 'Content notes' }
const SELF_HARM_NOTE = {
  vi: 'Nếu bạn đang gặp khó khăn, hãy chia sẻ với người bạn tin tưởng hoặc tìm hỗ trợ chuyên môn.',
  en: 'If you’re going through a hard time, consider talking to someone you trust or reaching out for professional support.',
}
const NO_PENDING = 'Không có gợi ý nào chờ duyệt.'
// Sách do e2e tạo (e2e-admin-, e2e-shop-, e2e-hidden-…); còn lại là sách mẫu của e2e-seed (id nhỏ nhất)
const E2E_BOOK_SLUG = 'e2e-'

const categorySlugs: string[] = []
let leafId: number

test.beforeAll(async () => {
  const root = await createE2eCategory({ active: false })
  categorySlugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  categorySlugs.push(leaf.slug)
  leafId = leaf.id
})

test.afterAll(async () => {
  await cleanupE2eAdminData(categorySlugs)
})

/** Sách đang bán trong danh mục con (đang hiện) của gốc ẩn: không lên menu / danh sách, link trực tiếp vẫn xem được */
async function createBook(titleTag?: string) {
  return createE2eBook({ categoryId: leafId, titleTag })
}

/** Chờ `success`; khối lỗi hiện ra trước thì báo đúng câu lỗi thay vì hết giờ chờ */
async function expectOrThrow(success: Locator, alert: Locator, label: string) {
  await expect(success.or(alert).first()).toBeVisible({ timeout: 15_000 })
  if (await alert.isVisible()) throw new Error(`${label}: ${await alert.textContent()}`)
}

const warningsPanel = (page: Page) => main(page).getByTestId('book-warnings')

/** "Gợi ý bằng AI" ở trang sửa sách đang mở: MỘT lượt consume_warning_quota (e2e/gemini-budget.ts) */
async function suggestOne(page: Page) {
  const panel = warningsPanel(page)
  await panel.getByRole('button', { name: 'Gợi ý bằng AI' }).click()
  await expectOrThrow(panel.getByRole('link', { name: 'Xem gợi ý' }), panel.getByRole('alert'), 'Gợi ý bằng AI')
}

/** "Gợi ý cho sách chưa xét": lượt 1 của lô = MỘT lượt consume_warning_quota (e2e/gemini-budget.ts) */
async function startBatch(page: Page) {
  await main(page).getByRole('button', { name: 'Gợi ý cho sách chưa xét' }).click()
}

/** Trang sửa sách → "Xem gợi ý" → /admin/canh-bao?sach=<id>, chờ form duyệt hydrate */
async function openPendingSuggestion(page: Page, bookId: number) {
  await warningsPanel(page).getByRole('link', { name: 'Xem gợi ý' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/canh-bao\\?sach=${bookId}$`))
  const item = main(page).getByTestId('warning-suggestion')
  await expect(item).toHaveCount(1)
  await waitForHydration(page, 'main [data-testid="warning-suggestion"] button[type="submit"]')
  return item
}

/** Duyệt / Bỏ qua gợi ý duy nhất của trang `?sach=` → danh sách rỗng */
async function review(page: Page, item: Locator, decision: 'Duyệt' | 'Bỏ qua') {
  await item.getByRole('button', { name: decision, exact: true }).click()
  await expectOrThrow(main(page).getByText(NO_PENDING), item.getByRole('alert'), decision)
}

const shopMain = (page: Page) => page.getByRole('main')

/** Trang sách của khách đã stream xong (tên sách là h1) */
async function openShopBook(page: Page, path: string, title: string) {
  await page.goto(path)
  await expect(shopMain(page).getByRole('heading', { name: title, level: 1 })).toBeVisible()
  await waitForSettled(page)
}

test('(a) gợi ý → sửa nhãn → duyệt → khách thấy khung (vi + en), khung có sẵn trong HTML của server', async ({
  page,
  browser,
  baseURL,
}) => {
  const errors = collectErrors(page)
  const book = await createBook('[mock:warn-self-harm]')
  const guestContext = await browser.newContext({ baseURL, storageState: NO_SESSION })
  try {
    const guest = await guestContext.newPage()
    const guestErrors = collectErrors(guest)
    // Trước khi duyệt: chưa có nhãn → không có khung (trang này cũng đưa dữ liệu sách vào cache, duyệt phải làm mới)
    await openShopBook(guest, `/sach/${book.slug}`, book.title)
    await expect(shopMain(guest).getByTestId('content-warnings')).toHaveCount(0)

    await openBookEditor(page, book.id)
    await expect(warningsPanel(page).getByText('Chưa xét.')).toBeVisible()
    await suggestOne(page)
    const item = await openPendingSuggestion(page, book.id)
    await expect(item.getByText(`Lý do giả lập cho sách ${book.id}.`)).toBeVisible()
    await expect(item.getByRole('checkbox', { name: 'Tự hại / tự tử' })).toBeChecked()
    await expect(item.getByRole('checkbox', { name: 'Mất mát / tang thương' })).not.toBeChecked()
    await item.getByRole('checkbox', { name: 'Mất mát / tang thương' }).check()
    await review(page, item, 'Duyệt')

    const saved = await bookWarnings(book.id)
    expect(saved.content_warnings).toEqual(['loss', 'self_harm'])
    expect(saved.content_warnings_reviewed_at).not.toBeNull()

    // Khách tải lại: đúng 2 nhãn theo thứ tự enum + câu nhẹ nhàng của nhãn tự hại
    await guest.reload()
    await waitForSettled(guest)
    const noticeVi = shopMain(guest).getByRole('note', { name: NOTICE.vi })
    await expect(noticeVi).toBeVisible()
    await expect(noticeVi.getByRole('listitem')).toHaveText(['Mất mát / tang thương', 'Tự hại / tự tử'])
    await expect(noticeVi.getByText(SELF_HARM_NOTE.vi)).toBeVisible()

    await openShopBook(guest, `/en/books/${book.slug}`, book.title)
    const noticeEn = shopMain(guest).getByRole('note', { name: NOTICE.en })
    await expect(noticeEn.getByRole('listitem')).toHaveText(['Loss / grief', 'Self-harm / suicide'])
    await expect(noticeEn.getByText(SELF_HARM_NOTE.en)).toBeVisible()

    // Khung render ở server cùng nội dung sách (không chèn sau bằng JS): có sẵn trong HTML trả về
    const response = await guestContext.request.get(`/sach/${book.slug}`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(NOTICE.vi)
    expect(html).toContain('Tự hại / tự tử')
    expect(guestErrors).toEqual([])
    expect(errors).toEqual([])
  } finally {
    await guestContext.close()
    await cleanupE2eAdminData([book.slug])
  }
})

test('(b) bỏ qua gợi ý → khách không thấy khung, trang sửa sách hiện "Đã xét lúc …"', async ({ page, browser, baseURL }) => {
  const errors = collectErrors(page)
  const book = await createBook('[mock:warn-violence]')
  const guestContext = await browser.newContext({ baseURL, storageState: NO_SESSION })
  try {
    await openBookEditor(page, book.id)
    await suggestOne(page)
    const item = await openPendingSuggestion(page, book.id)
    await expect(item.getByRole('checkbox', { name: 'Bạo lực / máu me' })).toBeChecked()
    await review(page, item, 'Bỏ qua')

    const saved = await bookWarnings(book.id)
    expect(saved.content_warnings).toEqual([])
    expect(saved.content_warnings_reviewed_at).not.toBeNull()
    expect((await warningSuggestionsOf(book.id)).map((row) => row.status)).toEqual(['dismissed'])

    const guest = await guestContext.newPage()
    const guestErrors = collectErrors(guest)
    await openShopBook(guest, `/sach/${book.slug}`, book.title)
    await expect(shopMain(guest).getByTestId('content-warnings')).toHaveCount(0)

    await openBookEditor(page, book.id)
    await expect(warningsPanel(page).getByText(/^Đã xét lúc /)).toBeVisible()
    expect(guestErrors).toEqual([])
    expect(errors).toEqual([])
  } finally {
    await guestContext.close()
    await cleanupE2eAdminData([book.slug])
  }
})

test('(c) nhãn vừa sửa ở form sách (tab khác) → duyệt gợi ý cũ báo SUGGESTION_STATUS_CHANGED, giữ bản sửa tay', async ({
  page,
}) => {
  const errors = collectErrors(page)
  const book = await createBook()
  // Gợi ý chờ duyệt tạo bằng service role: không tốn lượt AI
  const suggestionId = await insertWarningSuggestion(book.id, ['violence'])
  const other = await page.context().newPage()
  try {
    // Trang A mở khi sách còn chưa xét: form duyệt không có ô thời điểm xét (action bỏ khóa p_expected_reviewed_at)
    await page.goto(`/admin/canh-bao?sach=${book.id}`)
    const item = main(page).getByTestId('warning-suggestion')
    await expect(item).toHaveCount(1)
    await expect(item.locator('input[name="expected_reviewed_at"]')).toHaveCount(0)
    await waitForHydration(page, 'main [data-testid="warning-suggestion"] button[type="submit"]')

    // Trang B (cùng phiên admin): sửa ô nhãn ở form sách rồi lưu → sách thành đã xét
    await openBookEditor(other, book.id)
    await main(other).getByRole('group', { name: 'Nhãn cảnh báo' }).getByRole('checkbox', { name: 'Nội dung người lớn' }).check()
    await saveBook(other)
    const manual = await bookWarnings(book.id)
    expect(manual.content_warnings).toEqual(['adult'])
    expect(manual.content_warnings_reviewed_at).not.toBeNull()

    // Trang A duyệt gợi ý cũ → lỗi tại form + trang làm mới (hiện nhãn đang lưu mới của sách)
    await item.getByRole('button', { name: 'Duyệt', exact: true }).click()
    await expect(item.getByRole('alert')).toContainText('vừa được đổi ở nơi khác', { timeout: 15_000 })
    await expect(item.getByText('Nhãn đang lưu của sách: Nội dung người lớn')).toBeVisible()

    expect(await bookWarnings(book.id)).toEqual(manual)
    expect(await warningSuggestionRow(suggestionId)).toMatchObject({ status: 'pending', reviewed_at: null })
    expect(errors).toEqual([])
  } finally {
    await other.close()
    await cleanupE2eAdminData([book.slug])
  }
})

test('(d) sách đã bỏ qua → "Gợi ý bằng AI" lần nữa → duyệt được (gửi đúng thời điểm xét), khách thấy khung', async ({
  page,
  browser,
  baseURL,
}) => {
  const errors = collectErrors(page)
  const book = await createBook('[mock:warn-violence]')
  const guestContext = await browser.newContext({ baseURL, storageState: NO_SESSION })
  try {
    await openBookEditor(page, book.id)
    await suggestOne(page)
    await review(page, await openPendingSuggestion(page, book.id), 'Bỏ qua')
    const dismissed = await bookWarnings(book.id)
    expect(dismissed).toMatchObject({ content_warnings: [] })
    expect(dismissed.content_warnings_reviewed_at).not.toBeNull()

    await openBookEditor(page, book.id)
    await expect(warningsPanel(page).getByText(/^Đã xét lúc /)).toBeVisible()
    await suggestOne(page)
    const item = await openPendingSuggestion(page, book.id)
    // Sách đã xét: form gửi lại thời điểm xét đọc lúc mở trang (thiếu → RPC luôn báo SUGGESTION_STATUS_CHANGED)
    await expect(item.locator('input[name="expected_reviewed_at"]')).toHaveCount(1)
    await review(page, item, 'Duyệt')

    expect((await bookWarnings(book.id)).content_warnings).toEqual(['violence'])
    expect((await warningSuggestionsOf(book.id)).map((row) => row.status)).toEqual(['dismissed', 'approved'])

    const guest = await guestContext.newPage()
    const guestErrors = collectErrors(guest)
    await openShopBook(guest, `/sach/${book.slug}`, book.title)
    const notice = shopMain(guest).getByRole('note', { name: NOTICE.vi })
    await expect(notice.getByRole('listitem')).toHaveText(['Bạo lực / máu me'])
    await expect(notice.getByText(SELF_HARM_NOTE.vi)).toHaveCount(0)
    expect(guestErrors).toEqual([])
    expect(errors).toEqual([])
  } finally {
    await guestContext.close()
    await cleanupE2eAdminData([book.slug])
  }
})

test('(e) lô: đúng 12 cuốn kế tiếp chưa xét chưa có gợi ý (anti-join trên DB thật), số đếm trên trang', async ({ page }) => {
  const errors = collectErrors(page)
  const count = WARNING_LIMITS.booksPerCall
  // Tính độc lập với anti-join của app (hai query + lọc trong bộ nhớ). Đầu danh sách là sách mẫu (id nhỏ nhất): spec
  // khác chỉ tạo / duyệt gợi ý trên sách e2e của mình, nên nhóm này không đổi trong lúc test chạy.
  const before = await maxWarningSuggestionId()
  const [first, ...next] = (await unreviewedBooksWithoutPending()).slice(0, count + 1)
  if (!first || next.length < count || [first, ...next].some((book) => book.slug.startsWith(E2E_BOOK_SLUG))) {
    throw new Error(`Cần ${count + 1} sách mẫu chưa xét chưa có gợi ý đứng đầu theo id (e2e/fixtures/books.json)`)
  }
  try {
    // Cuốn đầu đã có gợi ý chờ duyệt → lô phải bỏ qua nó (anti-join), lấy đúng 12 cuốn sau
    await insertWarningSuggestion(first.id, [])
    await page.goto('/admin/canh-bao')
    await startBatch(page)
    await expectOrThrow(main(page).getByText(/^Xong lượt 1\./), main(page).getByRole('alert'), 'Lô gợi ý')
    // Dừng trong lúc chờ lượt 2 (30 giây): chỉ đúng một lượt
    await main(page).getByRole('button', { name: 'Dừng' }).click()
    await expect(main(page).getByText('Đã dừng lô.')).toBeVisible()
    await expect(main(page).getByText(`Đã tạo ${count} gợi ý.`)).toBeVisible()

    // Gợi ý mới trên sách mẫu: đúng cuốn đầu (service role) + 12 cuốn kế tiếp, đều chờ duyệt; cuốn đầu vẫn chỉ một gợi ý
    const created = (await warningSuggestionsAfter(before)).filter((row) => !row.books?.slug.startsWith(E2E_BOOK_SLUG))
    expect(created.map((row) => row.book_id).toSorted((a, b) => a - b)).toEqual([first.id, ...next.map((book) => book.id)])
    expect(created.every((row) => row.status === 'pending')).toBe(true)
    expect((await warningSuggestionsOf(first.id)).filter((row) => row.status === 'pending')).toHaveLength(1)

    // Số đếm (head: true + anti-join) của trang. Spec khác chạy song song tạo / duyệt gợi ý trên sách e2e của chúng nên
    // không so bằng tuyệt đối; hai cận dưới chỉ dựa vào sách mẫu (không ai khác đụng tới):
    // - chưa xét − chưa có gợi ý = số sách chưa xét có gợi ý chờ duyệt ≥ 13 gợi ý của test này (anti-join bị bỏ qua →
    //   hai số bằng nhau → 0);
    // - chưa có gợi ý ≥ số sách mẫu chưa xét chưa có gợi ý (count null / sai bộ lọc embed → 0 hoặc thiếu).
    await page.goto('/admin/canh-bao')
    const text = (await main(page).getByTestId('warnings-counts').textContent()) ?? ''
    const match = /Sách chưa xét: ([\d.]+), trong đó chưa có gợi ý: ([\d.]+)\./.exec(text)
    if (!match?.[1] || !match[2]) throw new Error(`Không đọc được số đếm: ${text}`)
    const unreviewed = Number(match[1].replaceAll('.', ''))
    const unsuggested = Number(match[2].replaceAll('.', ''))
    const catalogUnsuggested = (await unreviewedBooksWithoutPending()).filter(
      (book) => !book.slug.startsWith(E2E_BOOK_SLUG),
    ).length
    expect(catalogUnsuggested).toBeGreaterThan(0)
    expect(unreviewed - unsuggested).toBeGreaterThanOrEqual(count + 1)
    expect(unsuggested).toBeGreaterThanOrEqual(catalogUnsuggested)
    expect(errors).toEqual([])
  } finally {
    // Chỉ gợi ý chờ duyệt trên sách mẫu do test này tạo (không duyệt / bỏ qua gợi ý của sách mẫu)
    const mine = (await warningSuggestionsAfter(before)).filter((row) => !row.books?.slug.startsWith(E2E_BOOK_SLUG))
    await deleteWarningSuggestions(mine.map((row) => row.id))
  }
})
