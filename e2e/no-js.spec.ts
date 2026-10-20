import { expect, test } from '@playwright/test'
import { collectErrors, waitForHydration } from './helpers'

// Tắt JavaScript (docs/plans/no-js.md, phần A): phần stream (Suspense) không hiện, form Server Action trả kết quả ra
// trang trắng (đo cả production) → dải <noscript> ở [locale]/layout.tsx + câu báo ngay trên nút gửi của 3 form auth.
// Không hứa chạy được khi tắt JS; chỉ kiểm câu giải thích hiện đúng chỗ, và không hiện / không lỗi hydrate khi có JS.

const BAND = 'Trang này cần bật JavaScript để hiện đầy đủ sách, giỏ hàng và tài khoản. Hãy bật JavaScript rồi tải lại trang.'
const BAND_EN =
  'This site needs JavaScript to show books, your cart and your account in full. Please turn on JavaScript and reload the page.'
const SUBMIT_NOTE = 'Khi tắt JavaScript, sau khi gửi bạn sẽ không thấy kết quả. Hãy bật JavaScript.'

test.describe('tắt JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  for (const path of ['/', '/sach', '/dang-nhap']) {
    test(`dải noscript hiện dưới header: ${path}`, async ({ page }) => {
      await page.goto(path)
      const band = page.getByTestId('no-script')
      await expect(band).toBeVisible()
      await expect(band).toHaveText(BAND)
      const [bandBox, headerBox] = await Promise.all([band.boundingBox(), page.getByRole('banner').boundingBox()])
      expect(bandBox?.y ?? 0).toBeGreaterThanOrEqual((headerBox?.y ?? 0) + (headerBox?.height ?? 0) - 1)
      const fontSize = await band.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
      expect(fontSize).toBeGreaterThanOrEqual(16)
    })
  }

  test('dải noscript tiếng Anh ở /en', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByTestId('no-script')).toHaveText(BAND_EN)
  })

  for (const path of ['/dang-nhap', '/dang-ky', '/quen-mat-khau']) {
    test(`form ${path}: câu báo ngay trên nút gửi`, async ({ page }) => {
      await page.goto(path)
      const form = page.getByRole('main').locator('form')
      const note = form.getByTestId('no-script-submit')
      await expect(note).toBeVisible()
      await expect(note).toHaveText(SUBMIT_NOTE)
      const submit = form.locator('button[type="submit"]')
      const [noteBox, submitBox] = await Promise.all([note.boundingBox(), submit.boundingBox()])
      expect(noteBox?.y ?? Infinity).toBeLessThan(submitBox?.y ?? 0)
    })
  }
})

test.describe('bật JavaScript', () => {
  for (const path of ['/', '/sach', '/dang-nhap', '/dang-ky', '/quen-mat-khau', '/en']) {
    test(`không hiện câu noscript, không lỗi hydrate: ${path}`, async ({ page }) => {
      const errors = collectErrors(page)
      await page.goto(path)
      await waitForHydration(page, 'header button[aria-haspopup="dialog"]')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('no-script')).toHaveCount(0)
      await expect(page.getByTestId('no-script-submit')).toHaveCount(0)
      await expect(page.getByText(BAND)).toBeHidden()
      await expect(page.getByText(SUBMIT_NOTE)).toBeHidden()
      expect(errors).toEqual([])
    })
  }
})
