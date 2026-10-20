import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { addFromBookPage } from './cart'
import { collectErrors, waitForHydration } from './helpers'

// Mục 14 (ux-messages): trang đăng nhập / quên mật khẩu chỉ có MỘT form ngay từ đầu. Trước đây form nằm trong Suspense
// với fallback là một form khác; sau điều hướng phía client, fallback hydrate trước rồi bị thay ~60 ms sau → chữ khách
// gõ ngay lúc ô hiện ra bị mất (CI tái hiện ~3/24 lần trên mobile). Ở đây gõ ngay khi ô hiện ra, không chờ hydrate.
// Đăng nhập khi tắt JS (cần user): login-nojs-account.spec.ts.

// Playwright chạy từ thư mục gốc repo và biên dịch spec sang CommonJS (không có import.meta)
const fixture: { slug: string; stock: number }[] = JSON.parse(readFileSync('e2e/fixtures/books.json', 'utf8'))
const book = fixture.find((entry) => entry.stock >= 20)
if (!book) throw new Error('e2e/fixtures/books.json thiếu sách còn hàng (tồn ≥ 20)')

/** Đếm <form> được thêm vào trang kể từ lúc gọi: trang đăng nhập thêm đúng một; form bị thay = thêm lần nữa */
async function watchAddedForms(page: Page) {
  await page.evaluate(() => {
    const counter = { added: 0 }
    Reflect.set(window, '__addedForms', counter)
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement) || !node.closest('main')) continue
          counter.added += (node.matches('form') ? 1 : 0) + node.querySelectorAll('form').length
        }
      }
    }).observe(document.body, { childList: true, subtree: true })
  })
}

const addedForms = (page: Page) =>
  page.evaluate(() => {
    const counter: unknown = Reflect.get(window, '__addedForms')
    return typeof counter === 'object' && counter !== null ? Number(Reflect.get(counter, 'added')) : Number.NaN
  })

test('giỏ → "Thanh toán" (điều hướng phía client) → gõ email ngay: chữ không mất, chỉ một form, next đúng', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const errors = collectErrors(page)
  await addFromBookPage(page, { id: 0, slug: book.slug, title: '', price: 0, stock: book.stock })
  // Nhiều lượt: lỗi cũ chỉ xảy ra khi phần đọc searchParams stream tới sau lúc fallback đã hydrate
  for (let round = 1; round <= 5; round++) {
    await page.goto('/gio-hang')
    await waitForHydration(page, 'main a[href="/thanh-toan"]')
    await watchAddedForms(page)
    await page.getByRole('main').getByRole('link', { name: 'Thanh toán' }).click()
    await expect(page).toHaveURL(/\/dang-nhap\?next=%2Fthanh-toan$/)
    const email = page.getByRole('main').getByLabel('Email')
    await email.fill(`khach-${round}@example.com`)
    // Trang đã hydrate xong và phần chạy ở client đã chạy (next điền sau hydrate): lỗi cũ thay form đúng khoảng này
    await waitForHydration(page, 'main form button[type="submit"]')
    await expect(page.getByRole('main').locator('form input[type="hidden"][name="next"]')).toHaveValue('/thanh-toan')
    await expect(email, `lượt ${round}`).toHaveValue(`khach-${round}@example.com`)
    expect(await addedForms(page), `lượt ${round}`).toBe(1)
  }
  expect(errors).toEqual([])
})

test('đăng nhập → "Quên mật khẩu?" (điều hướng phía client) → gõ email ngay: chữ không mất, chỉ một form', async ({
  page,
}) => {
  const errors = collectErrors(page)
  for (let round = 1; round <= 3; round++) {
    await page.goto('/dang-nhap')
    await waitForHydration(page, 'main a[href="/quen-mat-khau"]')
    await watchAddedForms(page)
    await page.getByRole('main').getByRole('link', { name: 'Quên mật khẩu?' }).click()
    await expect(page).toHaveURL(/\/quen-mat-khau$/)
    const email = page.getByRole('main').getByLabel('Email')
    await email.fill(`quen-${round}@example.com`)
    await waitForHydration(page, 'main form button[type="submit"]')
    await expect(email, `lượt ${round}`).toHaveValue(`quen-${round}@example.com`)
    expect(await addedForms(page), `lượt ${round}`).toBe(1)
  }
  expect(errors).toEqual([])
})
