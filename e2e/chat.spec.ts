import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { badge } from './cart'
import { ask, bubble, CONFIRM_AGE, openChat } from './chat'
import { collectErrors } from './helpers'

// Chatbot Mây (Phase 11), desktop + mobile, khách chưa đăng nhập. AI giả, không gọi Gemini thật.
// Playwright chạy từ thư mục gốc repo và biên dịch spec sang CommonJS (không có import.meta)
const fixture: { slug: string; description: string }[] = JSON.parse(readFileSync('e2e/fixtures/books.json', 'utf8'))
const sapiens = fixture.find((book) => book.slug === 'sapiens')
if (!sapiens) throw new Error('e2e/fixtures/books.json thiếu sapiens')

test.describe('bong bóng chỉ có ở trang tiếng Việt (trừ thanh toán)', () => {
  for (const path of ['/', '/sach', '/sach/sapiens', '/danh-muc/van-hoc', '/gio-hang', '/tim-kiem?q=lich']) {
    test(`có ở ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(bubble(page)).toBeVisible()
    })
  }

  for (const path of ['/en', '/en/books/sapiens', '/en/cart', '/dang-nhap']) {
    test(`không có ở ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('main')).toBeVisible()
      await expect(bubble(page)).toHaveCount(0)
    })
  }
})

test('xác nhận 18+: chưa bấm thì không hỏi được; đã bấm thì nhớ trong tab, tab mới hỏi lại', async ({ page, browser }) => {
  await page.goto('/')
  const panel = await openChat(page, { confirm: false })
  await expect(panel.getByText('Mây dành cho người từ 18 tuổi.')).toBeVisible()
  await expect(panel.getByText('Ở gói miễn phí, Google có thể dùng nội dung bạn gửi', { exact: false })).toBeVisible()
  await expect(panel.getByLabel('Câu hỏi cho Mây')).toBeDisabled()
  await expect(panel.getByRole('button', { name: 'Gửi' })).toBeDisabled()
  await expect(panel.getByRole('button', { name: 'Sách nhẹ nhàng đọc cuối tuần' })).toBeDisabled()

  await panel.getByRole('button', { name: CONFIRM_AGE }).click()
  await expect(panel.getByLabel('Câu hỏi cho Mây')).toBeEnabled()
  await expect(panel.getByLabel('Câu hỏi cho Mây')).toBeFocused()
  const reply = await ask(panel, 'Gợi ý sách nhẹ nhàng')
  await expect(reply).toHaveAttribute('data-testid', 'chat-reply')

  // Đóng, tải lại trang trong cùng tab: không hỏi lại (sessionStorage)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await page.reload()
  const reopened = await openChat(page, { confirm: false })
  await expect(reopened.getByRole('button', { name: CONFIRM_AGE })).toHaveCount(0)
  await expect(reopened.getByLabel('Câu hỏi cho Mây')).toBeEnabled()

  const other = await browser.newContext()
  try {
    const fresh = await other.newPage()
    await fresh.goto('/')
    const freshPanel = await openChat(fresh, { confirm: false })
    await expect(freshPanel.getByRole('button', { name: CONFIRM_AGE })).toBeVisible()
  } finally {
    await other.close()
  }
})

test('câu tâm trạng → tối đa 3 thẻ sách, bấm thẻ mở đúng trang sách', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const panel = await openChat(page)
  const reply = await ask(panel, 'Tôi đang thấy mông lung, lạc hướng')
  const cards = reply.getByTestId('chat-book-card')
  const count = await cards.count()
  expect(count).toBeGreaterThan(0)
  expect(count).toBeLessThanOrEqual(3)
  const href = await cards.first().getAttribute('href')
  expect(href).toMatch(/^\/sach\/[a-z0-9-]+$/)
  await cards.first().click()
  await expect(page).toHaveURL(href ?? '')
  expect(errors).toEqual([])
})

test('AI trả 5 slug (1 slug lạ) → đúng 3 thẻ, không có slug lạ', async ({ page }) => {
  await page.goto('/')
  const panel = await openChat(page)
  const reply = await ask(panel, 'Gợi ý sách [mock:5-books]')
  await expect(reply.getByTestId('chat-book-card')).toHaveCount(3)
  await expect(reply.locator('a[href="/sach/sach-khong-ton-tai"]')).toHaveCount(0)
})

test('hỏi ở trang sách: chỉ gửi slug, server tự tra sách', async ({ page }) => {
  await page.goto('/sach/sapiens')
  const panel = await openChat(page)
  const request = page.waitForRequest((r) => r.method() === 'POST' && 'next-action' in r.headers())
  const reply = await ask(panel, 'Cuốn này nói về gì?')
  const body = (await request).postData() ?? ''
  expect(body).toContain('sapiens')
  expect(body).not.toContain(sapiens.description.slice(0, 40))
  await expect(reply).toContainText('Sapiens')
  await expect(panel.getByText('Đang hỏi về: Sapiens')).toBeVisible()
})

test('hết lượt của khách: câu thứ 11 trong giờ → thông báo thân thiện + link tìm sách', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')
  const panel = await openChat(page)
  for (let index = 1; index <= 10; index++) {
    const reply = await ask(panel, `Gợi ý sách số ${index}`)
    await expect(reply).toHaveAttribute('data-testid', 'chat-reply')
  }
  const limited = await ask(panel, 'Gợi ý sách số 11')
  await expect(limited).toHaveAttribute('data-code', 'CHAT_QUOTA_EXCEEDED')
  await expect(limited).toContainText('Bạn đã hỏi Mây nhiều câu trong giờ này')
  await limited.getByRole('link', { name: 'Tìm sách' }).click()
  await expect(page).toHaveURL(/\/tim-kiem$/)
})

test('Gemini 429 (giả) → khối "hết lượt miễn phí" song ngữ, có link, câu sau trong cooldown cũng vậy', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const panel = await openChat(page)
  const limited = await ask(panel, 'Gợi ý sách [mock:429]')
  await expect(limited).toHaveAttribute('data-code', 'CHAT_FREE_QUOTA')
  await expect(limited).toContainText('giới hạn lượt dùng miễn phí')
  await expect(limited.locator('p[lang="en"]')).toContainText('free usage limit')
  await expect(limited.getByRole('link', { name: 'Tìm sách' })).toHaveAttribute('href', '/tim-kiem')
  await expect(limited.getByRole('link', { name: /^Xem theo thể loại: / }).first()).toHaveAttribute('href', /^\/danh-muc\//)

  const again = await ask(panel, 'Gợi ý sách khác')
  await expect(again).toHaveAttribute('data-code', 'CHAT_FREE_QUOTA')
  expect(errors).toEqual([])
})

test('câu tự hại → câu hỗ trợ cố định, không có thẻ sách', async ({ page }) => {
  await page.goto('/')
  const panel = await openChat(page)
  const reply = await ask(panel, 'Tôi muốn chết')
  await expect(reply).toContainText('cấp cứu 115')
  await expect(reply.getByTestId('chat-book-card')).toHaveCount(0)
})

test('câu hỏi tối đa 300 ký tự', async ({ page }) => {
  await page.goto('/')
  const panel = await openChat(page)
  const input = panel.getByLabel('Câu hỏi cho Mây')
  await input.fill('a'.repeat(301))
  await expect(input).toHaveValue('a'.repeat(300))
  await expect(panel.getByText('300/300 ký tự')).toBeVisible()
})

test('mobile: tấm toàn màn hình, nút Đóng rõ ràng, nền không cuộn, đóng trả focus về bong bóng', async ({ page, isMobile }) => {
  await page.goto('/')
  const panel = await openChat(page)
  const box = await panel.boundingBox()
  const viewport = page.viewportSize()
  if (isMobile) {
    expect(box?.width).toBe(viewport?.width)
    expect(box?.height).toBe(viewport?.height)
    await expect(panel.getByRole('button', { name: 'Đóng' })).toBeVisible()
    await expect(page.locator('body')).toHaveAttribute('data-scroll-locked', /.*/)
  } else {
    expect(box?.width).toBe(360)
  }
  await panel.getByRole('button', { name: 'Đóng' }).click()
  await expect(panel).toBeHidden()
  await expect(bubble(page)).toBeFocused()
})

async function assertNotCovering(page: Page, target: Locator) {
  for (const position of ['top', 'target-at-bottom', 'end'] as const) {
    if (position === 'top') await page.evaluate(() => window.scrollTo(0, 0))
    if (position === 'target-at-bottom') await target.evaluate((element) => element.scrollIntoView({ block: 'end' }))
    if (position === 'end') await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    // Hiệu ứng ẩn / hiện 200ms
    await page.waitForTimeout(300)
    const bubbleBox = (await bubble(page).isVisible()) ? await bubble(page).boundingBox() : null
    const targetBox = (await target.isVisible()) ? await target.boundingBox() : null
    if (bubbleBox && targetBox) {
      const overlap =
        bubbleBox.x < targetBox.x + targetBox.width &&
        targetBox.x < bubbleBox.x + bubbleBox.width &&
        bubbleBox.y < targetBox.y + targetBox.height &&
        targetBox.y < bubbleBox.y + bubbleBox.height
      expect(overlap, `bong bóng che nút ở vị trí ${position}`).toBe(false)
    }
    if (targetBox) await target.click({ trial: true })
  }
}

test('bong bóng không che nút "Thêm vào giỏ" và "Thanh toán"', async ({ page }) => {
  await page.goto('/sach/sapiens')
  await expect(bubble(page)).toBeVisible()
  const addToCart = page.getByRole('main').getByRole('button', { name: /Thêm vào giỏ/ })
  await expect(addToCart).toBeVisible()
  await assertNotCovering(page, addToCart)

  await addToCart.click()
  await expect(badge(page)).toHaveText('1')
  await page.goto('/gio-hang')
  const checkout = page.getByRole('main').getByRole('link', { name: 'Thanh toán' })
  await expect(checkout).toBeVisible()
  await assertNotCovering(page, checkout)
})
