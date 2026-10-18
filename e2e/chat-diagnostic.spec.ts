import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { NO_SESSION } from './auth'
import { badge } from './cart'
import { waitForHydration } from './helpers'

// TẠM THỜI (Phase 11): thí nghiệm đối chứng cho flaky checkout.spec:98 (ô Email bị reset sau khi form đăng nhập
// hydrate). Cùng luồng khách → giỏ → Thanh toán → đăng nhập, ở tiếng Việt (có chatbot) và /en (không có chatbot).
// Ghi: form / input trong <main> có bị thay sau khi đã hydrate không, email còn giữ sau 1,5 s không. Không ghi nội
// dung text của trang. Kết quả ra test-results/ (artifact CI). Gỡ file này sau khi đọc.

const FLOWS = {
  vi: { book: '/sach/sapiens', add: 'Thêm vào giỏ', cart: '/gio-hang', checkout: 'Thanh toán', login: /\/dang-nhap\?next=/ },
  en: { book: '/en/books/sapiens', add: 'Add to cart', cart: '/en/cart', checkout: 'Checkout', login: /\/en\/login\?next=/ },
} as const

const ITERATIONS = 6

// MutationObserver: mọi lần <form> / <input> trong <main> bị thêm / gỡ, kèm thời điểm
const RECORDER = () => {
  const log: { t: number; kind: string; tag: string; hidden: boolean }[] = []
  Object.assign(window, { __formLog: log })
  const visit = (node: Node, kind: string) => {
    if (!(node instanceof Element)) return
    const targets = node.matches('form, input') ? [node] : [...node.querySelectorAll('form, input')]
    for (const target of targets) {
      if (!target.closest('main')) continue
      log.push({ t: Math.round(performance.now()), kind, tag: target.tagName.toLowerCase(), hidden: !target.closest('main')?.checkVisibility() })
    }
  }
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => visit(node, 'added'))
      record.removedNodes.forEach((node) => visit(node, 'removed'))
    }
  }).observe(document, { childList: true, subtree: true })
}

test('chẩn đoán: form đăng nhập sau điều hướng từ giỏ, có chatbot (vi) và không có (en)', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(300_000)
  const results: unknown[] = []
  const save = () => writeFileSync(testInfo.outputPath('login-diagnostic.json'), JSON.stringify(results, null, 1))

  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    for (const [locale, flow] of Object.entries(FLOWS)) {
      const context = await browser.newContext({ baseURL, storageState: NO_SESSION })
      const page = await context.newPage()
      await page.addInitScript(RECORDER)
      try {
        await page.goto(flow.book)
        await page.getByRole('main').getByRole('button', { name: flow.add }).click()
        await expect(badge(page)).toHaveText('1')
        await page.goto(flow.cart)
        await page.getByRole('main').getByTestId('cart-summary').getByRole('link', { name: flow.checkout }).click()
        await expect(page).toHaveURL(flow.login)
        const navigatedAt = await page.evaluate(() => Math.round(performance.now()))
        // Như fillLogin (e2e/auth.ts)
        await waitForHydration(page, 'main form button[type="submit"]')
        const hydratedAt = await page.evaluate(() => Math.round(performance.now()))
        await page.getByRole('main').getByLabel('Email').fill('chan-doan@example.com')
        await page.waitForTimeout(1_500)
        const kept = (await page.getByRole('main').getByLabel('Email').inputValue()) === 'chan-doan@example.com'
        const log = await page.evaluate(() => Reflect.get(window, '__formLog'))
        results.push({ iteration, locale, navigatedAt, hydratedAt, emailKept: kept, formLog: log })
      } catch (error) {
        results.push({ iteration, locale, error: error instanceof Error ? error.message.slice(0, 300) : 'lỗi' })
      } finally {
        await context.close()
      }
      save()
    }
  }
})
