import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { blockHydration, expectLockedUntilHydrated, waitForHydration } from './helpers'

// Playwright chạy từ thư mục gốc repo và biên dịch spec sang CommonJS (không có import.meta)
const fixture: { slug: string; stock: number }[] = JSON.parse(readFileSync('e2e/fixtures/books.json', 'utf8'))
const book = fixture.find((entry) => entry.stock >= 20)
if (!book) throw new Error('e2e/fixtures/books.json thiếu sách còn hàng (tồn ≥ 20)')

// ★8 (docs/plans/no-js.md): khách có JS bấm gửi trước khi React hydrate (4G chậm) từng đi đường POST thường → trang
// trắng dù action đã chạy. Nút gửi của form dùng useFormAction khóa tới khi hydrate. Form cần tài khoản:
// prehydrate-account.spec.ts.

const AUTH_FORMS = [
  { path: '/dang-nhap', field: 'password', heading: 'Đăng nhập' },
  { path: '/dang-ky', field: 'full_name', heading: 'Tạo tài khoản' },
  { path: '/quen-mat-khau', field: 'email', heading: 'Quên mật khẩu' },
]

for (const { path, field, heading } of AUTH_FORMS) {
  test(`${path}: trước hydrate nút gửi khóa, bấm / Enter không gửi POST, trang không trắng; sau hydrate nút bật`, async ({
    page,
  }) => {
    const blocked = await blockHydration(page)
    await page.goto(path)
    const form = page.getByRole('main').locator(`form:has(input[name="${field}"])`)
    const input = form.locator('input[name="email"]')
    await input.fill('khoa-nut@example.com')
    await expectLockedUntilHydrated(page, blocked, {
      submit: form.locator('button[type="submit"]'),
      selector: `main form:has(input[name="${field}"]) button[type="submit"]`,
      input,
      visible: page.getByRole('main').getByRole('heading', { level: 1, name: heading }),
    })
  })
}

// Ngoại lệ không khóa (src/lib/form-ready.test.ts → UNLOCKED_FORMS): thêm giỏ không JS kết thúc bằng 303 → khách chưa
// đăng nhập bấm trước hydrate được chuyển tới trang đăng nhập (trang thật, không trắng). Đăng xuất: prehydrate-account.spec.ts.
test('trước hydrate: "Thêm vào giỏ" (khách) vẫn gửi được, 303 sang đăng nhập kèm next, trang không trắng', async ({ page }) => {
  const blocked = await blockHydration(page)
  await page.goto(`/sach/${book.slug}`)
  const addToCart = page.getByRole('main').locator('form').getByRole('button', { name: /Thêm vào giỏ/ }).first()
  await expect(addToCart).toBeEnabled()
  await addToCart.click()
  await expect(page).toHaveURL(new RegExp(`/dang-nhap\\?next=%2Fsach%2F${book.slug}$`))
  expect(blocked.posts()).toBe(1)
  await expect(page.getByRole('main').locator('form:has(input[name="password"])')).toBeVisible()
})

// HTML server trả (chưa qua trình duyệt): nút gửi khóa sẵn, và autocomplete="off" để Firefox không khôi phục trạng thái
// disabled cũ của nút khi tải lại (nút bật sẵn trước hydrate). Chỉ trên nút, form không có (giữ tự điền email / mật khẩu).
for (const path of ['/dang-nhap', '/dang-ky', '/quen-mat-khau', '/en/login', '/en/register', '/en/forgot-password']) {
  test(`HTML thô ${path}: nút gửi có disabled + autocomplete="off", form không tắt autocomplete`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()
    const submits = html.match(/<button\b[^>]*\btype="submit"[^>]*>/g) ?? []
    expect(submits).toHaveLength(1)
    const [submit] = submits
    expect(submit).toMatch(/\sdisabled(=""|\s|>)/)
    expect(submit).toContain('aria-disabled="true"')
    // React SSR viết tên thuộc tính theo prop (`autoComplete="off"`); tên thuộc tính HTML không phân biệt hoa thường
    expect(submit).toMatch(/\sautocomplete="off"/i)
    const forms = html.match(/<form\b[^>]*>/g) ?? []
    expect(forms.length).toBeGreaterThan(0)
    for (const form of forms) expect(form).not.toMatch(/\sautocomplete=/i)
  })
}

// Đo (không kiểm) thời gian nút gửi khóa khi tải bình thường, in ra log CI (dòng KHOA-NUT) để ghi vào no-js.md ★8.
// Việc kiểm nút khóa trước hydrate / bật sau hydrate nằm ở các test theo AUTH_FORMS phía trên (expectLockedUntilHydrated)
// và no-js.spec.ts (tắt JS).
test('khoảng khóa /dang-nhap khi tải bình thường: đo và ghi thời gian từ lúc nút gửi hiện tới lúc bật', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const times: { shown?: number; enabled?: number } = {}
    Reflect.set(window, '__lock', times)
    const check = () => {
      const button = document.querySelector('main form button[type="submit"]')
      if (!button) return
      times.shown ??= performance.now()
      if (times.enabled === undefined && !button.hasAttribute('disabled')) times.enabled = performance.now()
    }
    new MutationObserver(check).observe(document, { childList: true, subtree: true, attributes: true })
  })
  await page.goto('/dang-nhap')
  await waitForHydration(page, 'main form button[type="submit"]')
  await expect(page.getByRole('main').locator('form button[type="submit"]')).toBeEnabled()
  const times: unknown = await page.evaluate(() => Reflect.get(window, '__lock'))
  if (
    typeof times !== 'object' ||
    times === null ||
    !('shown' in times) ||
    !('enabled' in times) ||
    typeof times.shown !== 'number' ||
    typeof times.enabled !== 'number'
  ) {
    throw new Error('Không đo được lúc nút hiện / bật')
  }
  const lockMs = Math.round(times.enabled - times.shown)
  testInfo.annotations.push({ type: 'lock-ms', description: String(lockMs) })
  console.log(`KHOA-NUT ${testInfo.project.name} /dang-nhap lockMs=${lockMs}`)
  expect(lockMs).toBeGreaterThanOrEqual(0)
})
