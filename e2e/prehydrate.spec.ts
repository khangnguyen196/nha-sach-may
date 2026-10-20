import { expect, test } from '@playwright/test'
import { blockHydration, expectLockedUntilHydrated, waitForHydration } from './helpers'

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
      visible: page.getByRole('heading', { level: 1, name: heading }),
    })
  })
}

test('khoảng khóa khi tải bình thường: từ lúc nút gửi hiện tới lúc nút bật (ghi lại, không kiểm ngưỡng)', async ({
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
