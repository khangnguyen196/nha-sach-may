import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'
import { storageStatePath } from './auth'
import { waitForHydration } from './helpers'

// Supabase chập chờn → trang lỗi đúng ngôn ngữ, "Thử lại" tải lại được. Playwright không chặn được request từ server
// Next tới Supabase, nên dùng cookie tiêm lỗi (src/lib/supabase/fault-injection.ts, chỉ bật khi server chạy với
// E2E_FAULT_INJECTION=1 — playwright.config.ts đặt sẵn): mọi request REST của client theo phiên ném lỗi mạng.
// User chính của project, chỉ đọc (danh sách đơn của user này luôn rỗng).
const test = base.extend({
  storageState: async ({}, provide, testInfo) => provide(storageStatePath(testInfo.project.name)),
})

async function breakSupabase(context: BrowserContext, baseURL: string | undefined) {
  await context.addCookies([{ name: 'e2e-fault', value: 'rest', url: baseURL ?? 'http://localhost:3100' }])
}

async function fixSupabase(context: BrowserContext) {
  await context.clearCookies({ name: 'e2e-fault' })
}

const main = (page: Page) => page.getByRole('main')

const cases = [
  {
    locale: 'vi',
    path: '/tai-khoan/don-hang',
    title: 'Có lỗi phía Nhà Sách Mây',
    reference: 'Mã tra cứu: ',
    retry: 'Thử lại',
    home: 'Về trang chủ',
    recovered: 'Đơn hàng của tôi',
  },
  {
    locale: 'en',
    path: '/en/account/orders',
    title: 'Something went wrong on our side',
    reference: 'Reference code: ',
    retry: 'Try again',
    home: 'Back to home',
    recovered: 'My orders',
  },
] as const

for (const c of cases) {
  test(`${c.path}: Supabase lỗi → trang lỗi ${c.locale}, "${c.retry}" tải lại được`, async ({ page, context, baseURL }) => {
    await breakSupabase(context, baseURL)
    await page.goto(c.path)

    const errorPage = main(page).getByTestId('error-page')
    await expect(errorPage.getByRole('heading', { level: 1 })).toHaveText(c.title)
    await expect(page.locator('html')).toHaveAttribute('lang', c.locale)
    // Header và footer của layout vẫn còn: lỗi nằm gọn trong boundary của (shop)
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()
    await expect(errorPage.getByRole('link', { name: c.home })).toHaveAttribute('href', c.locale === 'vi' ? '/' : '/en')
    // Lỗi ở server → có mã tra cứu (digest của Next) + email liên hệ; không còn câu đổ cho mạng
    await expect(errorPage.getByTestId('error-reference')).toHaveText(new RegExp(`^${c.reference}[\\w-]+$`))
    await expect(errorPage.getByRole('link', { name: 'nha-sach-may@googlegroups.com' })).toHaveAttribute(
      'href',
      'mailto:nha-sach-may@googlegroups.com',
    )
    await expect(errorPage).not.toContainText('chập chờn')
    // Không lộ chi tiết lỗi
    await expect(errorPage).not.toContainText('fetch failed')
    await expect(errorPage).not.toContainText('listOrders')
    await expect(page.getByText(/Application error|server-side exception/i)).toHaveCount(0)

    await fixSupabase(context)
    await waitForHydration(page, 'main [data-testid="error-page"] button')
    await errorPage.getByRole('button', { name: c.retry }).click()
    await expect(main(page).getByTestId('error-page')).toHaveCount(0)
    await expect(main(page).getByRole('heading', { level: 1, name: c.recovered })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${c.path}$`))
  })
}

test('trang lỗi: focus vào tiêu đề, điều hướng được bằng bàn phím', async ({ page, context, baseURL }) => {
  await breakSupabase(context, baseURL)
  await page.goto('/tai-khoan/don-hang')
  const heading = main(page).getByTestId('error-page').getByRole('heading', { level: 1 })
  await expect(heading).toBeFocused()
  // Email liên hệ nằm trong câu mô tả, trước nút "Thử lại"
  await page.keyboard.press('Tab')
  await expect(main(page).getByRole('link', { name: 'nha-sach-may@googlegroups.com' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(main(page).getByRole('button', { name: 'Thử lại' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(main(page).getByRole('link', { name: 'Về trang chủ' })).toBeFocused()
})
