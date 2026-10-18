import { test } from '@playwright/test'
import { writeFileSync } from 'node:fs'

// TẠM THỜI (Phase 11): tìm nguồn bản sao ẩn của bong bóng chat. Ghi chuỗi phần tử cha (tên thẻ, id, hidden, style,
// data-*; KHÔNG ghi nội dung text) ra test-results/ (artifact của CI). Gỡ file này sau khi đọc kết quả.

test('chẩn đoán: chuỗi phần tử cha của mọi bong bóng chat', async ({ page }, testInfo) => {
  const snapshots: unknown[] = []
  for (const path of ['/', '/sach/sapiens']) {
    await page.goto(path, { waitUntil: 'commit' })
    for (const moment of ['domcontentloaded', 'load', 'networkidle', 'after-1s'] as const) {
      if (moment === 'after-1s') await page.waitForTimeout(1_000)
      else await page.waitForLoadState(moment)
      snapshots.push({
        path,
        moment,
        bubbles: await page.evaluate(() =>
          [...document.querySelectorAll('[data-testid="chat-bubble"]')].map((element) => {
            const chain: Record<string, unknown>[] = []
            for (let node: Element | null = element; node && node !== document.documentElement; node = node.parentElement) {
              chain.push({
                tag: node.tagName.toLowerCase(),
                id: node.id || undefined,
                hidden: node.hasAttribute('hidden') || undefined,
                style: node.getAttribute('style')?.slice(0, 160) || undefined,
                display: getComputedStyle(node).display,
                data: Object.fromEntries(
                  [...node.attributes].filter((a) => a.name.startsWith('data-')).map((a) => [a.name, a.value.slice(0, 60)]),
                ),
              })
            }
            return {
              visible: element.checkVisibility(),
              hydrated: Object.keys(element).some((key) => key.startsWith('__reactProps')),
              indexInBody: [...document.body.querySelectorAll('*')].indexOf(element),
              chain,
            }
          }),
        ),
      })
    }
  }
  writeFileSync(testInfo.outputPath('bubble-dom.json'), JSON.stringify(snapshots, null, 1))
})
