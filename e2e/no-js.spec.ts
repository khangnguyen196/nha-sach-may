import { expect, test } from '@playwright/test'
import { collectErrors, waitForHydration } from './helpers'

// Tắt JavaScript (docs/plans/no-js.md, phần A): phần stream (Suspense) không hiện, form Server Action trả kết quả ra
// trang trắng (đo cả production) → dải <noscript> ở [locale]/layout.tsx + câu báo ngay trên nút gửi của 3 form auth;
// nút gửi khóa tới khi hydrate (★8), nên tắt JS thì không gửi được.
// Không hứa chạy được khi tắt JS; chỉ kiểm câu giải thích hiện đúng chỗ, và không hiện / không lỗi hydrate khi có JS.

const BAND = 'Trang này cần bật JavaScript để hiện đầy đủ sách, giỏ hàng và tài khoản. Hãy bật JavaScript rồi tải lại trang.'
const BAND_EN =
  'This page needs JavaScript to show books, your cart and your account in full. Please turn on JavaScript and reload the page.'
const SUBMIT_NOTE = 'Cần bật JavaScript để gửi biểu mẫu này.'

test.describe('tắt JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  for (const path of ['/', '/sach', '/dang-nhap']) {
    test(`dải noscript hiện dưới header: ${path}`, async ({ page }) => {
      await page.goto(path)
      const band = page.getByTestId('no-script')
      await expect(band).toBeVisible()
      await expect(band).toHaveText(BAND)
      const [bandBox, headerBox] = await Promise.all([band.boundingBox(), page.getByRole('banner').boundingBox()])
      if (!bandBox || !headerBox) throw new Error('Không đo được vị trí dải noscript / header')
      expect(bandBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1)
      const fontSize = await band.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
      expect(fontSize).toBeGreaterThanOrEqual(16)
    })
  }

  test('dải noscript tiếng Anh ở /en', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByTestId('no-script')).toHaveText(BAND_EN)
  })

  for (const path of ['/dang-nhap', '/dang-ky', '/quen-mat-khau']) {
    test(`form ${path}: câu báo ngay trên nút gửi, nút gửi khóa`, async ({ page }) => {
      await page.goto(path)
      const form = page.getByRole('main').locator('form')
      const note = form.getByTestId('no-script-submit')
      await expect(note).toBeVisible()
      await expect(note).toHaveText(SUBMIT_NOTE)
      const submit = form.locator('button[type="submit"]')
      const [noteBox, submitBox] = await Promise.all([note.boundingBox(), submit.boundingBox()])
      if (!noteBox || !submitBox) throw new Error('Không đo được vị trí câu noscript / nút gửi')
      expect(noteBox.y).toBeLessThan(submitBox.y)
      // ★8: không JS thì nút khóa (gửi lúc này là POST thường → trang trắng), giữ nguyên chữ
      await expect(submit).toBeDisabled()
      await expect(submit).toHaveAttribute('aria-disabled', 'true')
    })
  }
})

test.describe('bật JavaScript', () => {
  const AUTH_PAGES = ['/dang-nhap', '/dang-ky', '/quen-mat-khau']
  for (const path of ['/', '/sach', ...AUTH_PAGES, '/en']) {
    test(`không hiện câu noscript, không lỗi hydrate: ${path}`, async ({ page }) => {
      const errors = collectErrors(page)
      await page.goto(path)
      await waitForHydration(page, 'header button[aria-haspopup="dialog"]')
      await page.waitForLoadState('networkidle')
      // Bật JS: nội dung <noscript> chỉ là chữ, không thành phần tử
      await expect(page.getByTestId('no-script')).toHaveCount(0)
      await expect(page.getByTestId('no-script-submit')).toHaveCount(0)
      // …nhưng thẻ vẫn có trong trang (không ai lỡ xóa)
      await expect(page.locator('header + noscript')).toHaveCount(1)
      if (AUTH_PAGES.includes(path)) await expect(page.getByRole('main').locator('form noscript')).toHaveCount(1)
      expect(errors).toEqual([])
    })
  }
})
