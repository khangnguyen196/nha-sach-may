import { expect, test, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { NO_SESSION } from './auth'
import { badge } from './cart'

// TẠM THỜI (Phase 11): tìm nguồn bản sao ẩn của bong bóng chat và của nút submit sau điều hướng phía client.
// Ghi chuỗi phần tử cha (tên thẻ, id, hidden, style, display, data-*; KHÔNG ghi nội dung text) ra test-results/
// (artifact của CI). Gỡ file này sau khi đọc kết quả.

test.use({ storageState: NO_SESSION })

// MutationObserver cài trước mọi script của trang: ghi mọi lần một bong bóng được thêm / gỡ khỏi DOM
const RECORDER = () => {
  const log: unknown[] = []
  Object.assign(window, { __chatLog: log })
  const describe = (element: Element) => {
    const chain: string[] = []
    for (let node: Element | null = element; node && node !== document.documentElement; node = node.parentElement) {
      const data = [...node.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'hidden' || a.name === 'id')
      const style = node.getAttribute('style')
      chain.push(
        `${node.tagName.toLowerCase()}${data.map((a) => `[${a.name}=${a.value.slice(0, 40)}]`).join('')}${style ? `(style:${style.slice(0, 80)})` : ''}`,
      )
    }
    return chain.join(' < ')
  }
  const visit = (node: Node, kind: string) => {
    if (!(node instanceof Element)) return
    const bubbles = node.matches('[data-testid="chat-bubble"]') ? [node] : [...node.querySelectorAll('[data-testid="chat-bubble"]')]
    for (const bubble of bubbles) {
      log.push({ t: Math.round(performance.now()), kind, total: document.querySelectorAll('[data-testid="chat-bubble"]').length, chain: kind === 'added' ? describe(bubble) : undefined })
    }
  }
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => visit(node, 'added'))
      record.removedNodes.forEach((node) => visit(node, 'removed'))
    }
  }).observe(document, { childList: true, subtree: true })
}

async function snapshot(page: Page, selector: string) {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((element) => {
      const chain: string[] = []
      for (let node: Element | null = element; node && node !== document.documentElement; node = node.parentElement) {
        const attrs = [...node.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'hidden' || a.name === 'id')
        const display = getComputedStyle(node).display
        chain.push(`${node.tagName.toLowerCase()}${attrs.map((a) => `[${a.name}=${a.value.slice(0, 40)}]`).join('')}${display === 'none' ? '{none}' : ''}`)
      }
      return {
        visible: element.checkVisibility(),
        hydrated: Object.keys(element).some((key) => key.startsWith('__reactProps')),
        chain: chain.join(' < '),
      }
    })
  }, selector)
}

test('chẩn đoán: bong bóng lúc tải trang + sau điều hướng phía client; nút submit sau khi sang trang đăng nhập', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  await page.addInitScript(RECORDER)
  const result: Record<string, unknown> = {}
  const save = () => writeFileSync(testInfo.outputPath('dom-diagnostic.json'), JSON.stringify(result, null, 1))

  // 1. Tải mới trang chủ 5 lần, ghi liên tục
  const loads: unknown[] = []
  for (let index = 0; index < 5; index++) {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    loads.push(await page.evaluate(() => Reflect.get(window, '__chatLog')))
  }
  result.freshLoads = loads
  save()

  // 2. Điều hướng phía client: trang chủ → "Xem tất cả sách" (/sach) → một trang sách
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByRole('main').getByRole('link', { name: 'Xem tất cả sách' }).click()
  await expect(page).toHaveURL(/\/sach$/)
  result.afterClientNavToBooks = { log: await page.evaluate(() => Reflect.get(window, '__chatLog')), bubbles: await snapshot(page, '[data-testid="chat-bubble"]') }
  save()

  // 3. Giỏ (khách) → "Thanh toán" (Link) → proxy chuyển sang /dang-nhap: nút submit nào khớp selector của fillLogin
  await page.goto('/sach/sapiens')
  await page.waitForLoadState('networkidle')
  await page.getByRole('main').getByRole('button', { name: 'Thêm vào giỏ' }).click()
  await expect(badge(page)).toHaveText('1')
  await page.goto('/gio-hang')
  await page.waitForLoadState('networkidle')
  const checkout = page.getByRole('main').getByRole('link', { name: 'Thanh toán' })
  if (await checkout.count()) {
    await checkout.click()
    await expect(page).toHaveURL(/\/dang-nhap/)
    result.loginSubmitRightAfterNav = await snapshot(page, 'main form button[type="submit"]')
    result.mainsRightAfterNav = await snapshot(page, 'main')
    save()
    await page.waitForLoadState('networkidle')
    result.loginSubmitAfterIdle = await snapshot(page, 'main form button[type="submit"]')
  } else {
    result.cart = 'giỏ trống, không có link Thanh toán'
  }

  save()
})
