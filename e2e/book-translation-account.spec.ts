import { expect, test, type Page } from '@playwright/test'
import { cleanupE2eAdminData, createE2eBook, type E2eAdminBook } from '../scripts/e2e-user'
import { collectErrors } from './helpers'

// Mô tả sách theo ngôn ngữ trang + dòng "Bản dịch tự động" (docs/plans/mo-ta-song-ngu.md). Tên `…-account.spec.ts`
// (khớp ACCOUNT_SPECS) dù không cần user: chạy sau setup, trước teardown (cả hai xóa mọi dữ liệu e2e-admin-…). Sách
// e2e-admin-… tạo bằng service role (created_at năm 2000, không danh mục, giá rất cao: không lọt trang 1 của /sach mà
// spec khác đi qua), dọn đúng slug của spec. Không đụng sách thật.
test.describe.configure({ mode: 'serial' })

const VI = 'Mô tả tiếng Việt của sách thử nghiệm bản dịch.'
const EN = 'English description of the translation test book.'

let viBook: E2eAdminBook
let enBook: E2eAdminBook
let plainBook: E2eAdminBook
const slugs: string[] = []

test.beforeAll(async () => {
  const common = { categoryId: null, price: 9_900_000, description: VI, descriptionEn: EN }
  // Sách tiếng Việt: phần dịch là description_en
  viBook = await createE2eBook({ ...common, language: 'vi', autoTranslated: true })
  // Sách ngoại văn: phần dịch là description (tiếng Việt)
  enBook = await createE2eBook({ ...common, language: 'en', autoTranslated: true })
  // Cờ tắt: bản dịch do người viết → không có dòng
  plainBook = await createE2eBook({ ...common, language: 'vi', autoTranslated: false })
  slugs.push(viBook.slug, enBook.slug, plainBook.slug)
})

test.afterAll(async () => {
  await cleanupE2eAdminData(slugs)
})

async function expectDescription(page: Page, path: string, text: string, note: string | null) {
  const errors = collectErrors(page)
  const response = await page.goto(path)
  expect(response?.status()).toBe(200)
  const main = page.getByRole('main')
  await expect(main.getByText(text, { exact: true })).toBeVisible()
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', text)
  if (note) await expect(main.getByTestId('auto-translated')).toHaveText(note)
  else await expect(main.getByTestId('auto-translated')).toHaveCount(0)
  expect(errors).toEqual([])
}

test('sách tiếng Việt, cờ bật: /en hiện mô tả Anh + "Automatically translated"; trang Việt không có dòng', async ({
  page,
}) => {
  await expectDescription(page, `/en/books/${viBook.slug}`, EN, 'Automatically translated')
  await expectDescription(page, `/sach/${viBook.slug}`, VI, null)
})

test('sách ngoại văn, cờ bật: trang Việt hiện mô tả Việt + "Bản dịch tự động"; /en hiện bản Anh, không có dòng', async ({
  page,
}) => {
  await expectDescription(page, `/sach/${enBook.slug}`, VI, 'Bản dịch tự động')
  await expectDescription(page, `/en/books/${enBook.slug}`, EN, null)
})

test('cờ tắt: đúng ngôn ngữ ở cả hai trang, không có dòng dịch', async ({ page }) => {
  await expectDescription(page, `/sach/${plainBook.slug}`, VI, null)
  await expectDescription(page, `/en/books/${plainBook.slug}`, EN, null)
})
