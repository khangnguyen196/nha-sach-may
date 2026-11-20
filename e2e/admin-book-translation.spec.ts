import { expect, type Page } from '@playwright/test'
import {
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  type E2eAdminBook,
} from '../scripts/e2e-user'
import { adminTest as test, main, openBookEditor, saveBook } from './admin'

// Admin sửa phần dịch tự động → bỏ dấu "Bản dịch tự động"; lưu lại form không sửa gì → giữ dấu (docs/plans/mo-ta-song-ngu.md).
// Sách / danh mục test e2e-admin-… tạo bằng service role (form sửa sách cần danh mục lá: gốc ẩn + con đang hiện), dọn
// đúng slug của spec. Không đụng sách thật.
test.describe.configure({ mode: 'serial' })

const VI = 'Mô tả tiếng Việt của sách thử nghiệm bản dịch (admin).'
const EN = 'English description of the translation test book (admin).'
const EN_EDITED = 'English description, edited by hand in admin.'
const HINT = 'Bản dịch tự động — sửa ô này sẽ bỏ dấu.'

let book: E2eAdminBook
const slugs: string[] = []

test.beforeAll(async () => {
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  book = await createE2eBook({
    categoryId: leaf.id,
    description: VI,
    descriptionEn: EN,
    language: 'vi',
    autoTranslated: true,
  })
  slugs.push(book.slug)
})

test.afterAll(async () => {
  await cleanupE2eAdminData(slugs)
})

async function expectEnglishPage(page: Page, text: string, translatedNote: boolean) {
  await page.goto(`/en/books/${book.slug}`)
  await expect(main(page).getByText(text, { exact: true })).toBeVisible()
  const note = main(page).getByTestId('auto-translated')
  if (translatedNote) await expect(note).toHaveText('Automatically translated')
  else await expect(note).toHaveCount(0)
}

test('lưu form không sửa gì → dòng "Automatically translated" vẫn còn', async ({ page }) => {
  await openBookEditor(page, book.id)
  await expect(main(page).getByText(HINT)).toBeVisible()
  await saveBook(page)
  await expectEnglishPage(page, EN, true)

  await openBookEditor(page, book.id)
  await expect(main(page).getByText(HINT)).toBeVisible()
})

test('sửa phần dịch (mô tả tiếng Anh của sách Việt) → dòng dịch biến mất, câu nhắc trong admin cũng mất', async ({
  page,
}) => {
  await openBookEditor(page, book.id)
  await main(page).getByLabel('Mô tả (tiếng Anh)').fill(EN_EDITED)
  await saveBook(page)
  await expectEnglishPage(page, EN_EDITED, false)

  await openBookEditor(page, book.id)
  await expect(main(page).getByLabel('Mô tả (tiếng Anh)')).toHaveValue(EN_EDITED)
  await expect(main(page).getByText(HINT)).toHaveCount(0)
})
