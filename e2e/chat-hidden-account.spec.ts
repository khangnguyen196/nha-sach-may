import { expect, test, type Page } from '@playwright/test'
import { createE2eUser, deleteE2eUsers, setCartItem } from '../scripts/e2e-user'
import { login, NO_SESSION, readShopBooks } from './auth'
import { bubble, openChat } from './chat'
import { collectErrors } from './helpers'

// Khung chat (desktop: dialog không modal) đang mở khi điều hướng phía client sang trang ẩn chat (/thanh-toan): quay lại
// trang có bong bóng thì khung không tự mở lại và không kéo focus (docs/progress.md, muc-thap-1). Không gửi câu chat.
// User riêng + một cuốn sách e2e của project trong giỏ (có link "Thanh toán"); không đụng giỏ của user dùng chung.
test.use({ storageState: NO_SESSION })

test('khung chat đang mở → sang /thanh-toan (Link) → quay lại: khung không tự mở, không giữ focus', async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(isMobile, 'Mobile: khung chat là tấm modal toàn màn hình, không bấm được link của trang khi đang mở')
  const [book] = readShopBooks(testInfo.project.name).regular
  if (!book) throw new Error('Thiếu sách e2e regular của project')
  const user = await createE2eUser(`${testInfo.project.name}-chat-an`)
  try {
    await setCartItem(user.id, book.id, 1)
    await login(page, user)
    await page.goto('/gio-hang')
    const checkout = page.getByRole('main').getByRole('link', { name: 'Thanh toán' })
    await expect(checkout).toBeVisible()

    const panel = await openChat(page, { confirm: false })
    await expect(bubble(page)).toHaveAttribute('aria-expanded', 'true')
    // Khung nổi có thể che link: đi bằng bàn phím (Enter trên link = điều hướng phía client của Link)
    await checkout.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/thanh-toan$/)
    await expect(bubble(page)).toHaveCount(0)
    await expect(panel).toHaveCount(0)

    await page.goBack()
    await expect(page).toHaveURL(/\/gio-hang$/)
    await expect(bubble(page)).toBeVisible()
    await expect(bubble(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('chat-panel')).toHaveCount(0)
    const focusInPanel = await page.evaluate(() => document.activeElement?.closest('[data-testid="chat-panel"]') != null)
    expect(focusInPanel).toBe(false)
  } finally {
    await deleteE2eUsers([user.id])
  }
})

/** Trang không còn dấu vết tấm modal của Radix: khóa cuộn, chặn bấm, aria-hidden / inert quanh <main>; cuộn được */
async function expectPageUsable(page: Page, label: string) {
  // Back / Forward có thể khôi phục vị trí cuộn: đo ở đầu trang để điểm thử elementFromPoint nằm trong khung nhìn
  await page.evaluate(() => window.scrollTo(0, 0))
  const state = await page.evaluate(() => {
    const main = document.querySelector('main')
    const box = main?.getBoundingClientRect()
    const hit = box ? document.elementFromPoint(box.left + box.width / 2, Math.min(box.top + 40, window.innerHeight - 1)) : null
    return {
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      bodyOverflow: getComputedStyle(document.body).overflow,
      bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
      scrollLocked: document.body.hasAttribute('data-scroll-locked') || document.documentElement.hasAttribute('data-scroll-locked'),
      mainHidden: main?.closest('[aria-hidden="true"], [inert]') != null,
      hitInMain: hit !== null && main !== null && main.contains(hit),
    }
  })
  expect(state, label).toEqual({
    htmlOverflow: 'visible',
    bodyOverflow: 'visible',
    bodyPointerEvents: 'auto',
    scrollLocked: false,
    mainHidden: false,
    hitInMain: true,
  })
  // Cuộn bằng bánh xe (khóa cuộn của Radix chặn đúng đường này); trang thấp hơn màn hình thì không có gì để cuộn
  const room = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
  if (room > 0) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.mouse.wheel(0, 600)
    await expect.poll(() => page.evaluate(() => window.scrollY), { message: `${label}: cuộn được` }).toBeGreaterThan(0)
    await page.evaluate(() => window.scrollTo(0, 0))
  }
  return room
}

// Mobile: khung chat là tấm modal (khóa cuộn, chặn bấm ngoài, aria-hidden phần còn lại). Tấm đang mở mà trang chuyển sang
// trang ẩn chat bằng Forward (ChatBubbleInner trả null → tấm bị gỡ khi còn mở) thì Radix phải dọn hết; quay lại cũng vậy.
test('mobile: tấm chat đang mở bị gỡ khi Forward sang /thanh-toan → cả hai trang không còn khóa cuộn / chặn bấm', async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(!isMobile, 'Desktop: khung chat không modal (test ở trên)')
  const [book] = readShopBooks(testInfo.project.name).regular
  if (!book) throw new Error('Thiếu sách e2e regular của project')
  const user = await createE2eUser(`${testInfo.project.name}-chat-modal`)
  try {
    await setCartItem(user.id, book.id, 1)
    await login(page, user)
    const errors = collectErrors(page)
    await page.goto('/gio-hang')
    const checkout = page.getByRole('main').getByRole('link', { name: 'Thanh toán' })
    await checkout.click()
    await expect(page).toHaveURL(/\/thanh-toan$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/gio-hang$/)

    // Back có thể khôi phục vị trí cuộn; link "Thanh toán" (data-chat-avoid) ở dải đáy thì bong bóng ẩn → về đầu trang
    await page.evaluate(() => window.scrollTo(0, 0))
    await openChat(page, { confirm: false })
    // Tấm modal đang mở: Radix ẩn phần còn lại khỏi cây accessibility (getByRole không thấy bong bóng) → tìm theo test id
    await expect(page.getByTestId('chat-bubble')).toHaveAttribute('aria-expanded', 'true')
    await page.goForward()
    await expect(page).toHaveURL(/\/thanh-toan$/)
    await expect(page.getByTestId('chat-panel')).toHaveCount(0)
    await expect(page.getByRole('main').getByTestId('checkout-summary')).toBeVisible()
    // Trang thanh toán (form + tóm tắt) luôn cao hơn màn hình điện thoại: phải cuộn được
    expect(await expectPageUsable(page, '/thanh-toan sau Forward')).toBeGreaterThan(0)

    await page.goBack()
    await expect(page).toHaveURL(/\/gio-hang$/)
    await expect(bubble(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('chat-panel')).toHaveCount(0)
    await expectPageUsable(page, '/gio-hang sau Back')
    // Bấm thật được link của trang (điều hướng)
    await checkout.click()
    await expect(page).toHaveURL(/\/thanh-toan$/)
    expect(errors).toEqual([])
  } finally {
    await deleteE2eUsers([user.id])
  }
})

// Câu hỏi đang chờ trả lời khi sang trang ẩn chat rồi quay lại: khung mount lại vẫn biết đang chờ (cờ `waiting` ở bong
// bóng), không gửi chồng được; trả lời cũ về rồi mới gửi tiếp. Làm chậm đúng request Server Action của chat (AI giả,
// CHAT_AI_MOCK, không có chế độ chậm).
test('câu hỏi đang chờ → sang /thanh-toan → quay lại: vẫn "đang tìm", không gửi chồng; trả lời cũ về rồi gửi tiếp được', async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(isMobile, 'Mobile: tấm modal che link "Thanh toán" (luồng Link đi qua desktop)')
  const [book] = readShopBooks(testInfo.project.name).regular
  if (!book) throw new Error('Thiếu sách e2e regular của project')
  const user = await createE2eUser(`${testInfo.project.name}-chat-cho`)
  try {
    await setCartItem(user.id, book.id, 1)
    await login(page, user)
    const errors = collectErrors(page)
    await page.route('**/gio-hang', async (route) => {
      const request = route.request()
      if (request.method() === 'POST' && request.headers()['next-action']) await new Promise((resolve) => setTimeout(resolve, 6_000))
      await route.fallback()
    })
    await page.goto('/gio-hang')
    const checkout = page.getByRole('main').getByRole('link', { name: 'Thanh toán' })
    await expect(checkout).toBeVisible()

    const panel = await openChat(page)
    await panel.getByLabel('Câu hỏi cho Mây').fill('Gợi ý sách lịch sử')
    await panel.getByRole('button', { name: 'Gửi' }).click()
    await expect(panel.getByText('Mây đang tìm sách…')).toBeVisible()
    await checkout.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/thanh-toan$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/gio-hang$/)

    await bubble(page).click()
    const again = page.getByTestId('chat-panel')
    await expect(again).toBeVisible()
    await expect(again.getByText('Mây đang tìm sách…')).toBeVisible()
    await again.getByLabel('Câu hỏi cho Mây').fill('Gợi ý sách văn học')
    await expect(again.getByRole('button', { name: 'Gửi' })).toBeDisabled()

    const replies = again.locator('[data-testid="chat-reply"], [data-testid="chat-error"]')
    await expect(replies).toHaveCount(1, { timeout: 15_000 })
    await expect(again.getByTestId('chat-reply')).toHaveCount(1)
    await again.getByRole('button', { name: 'Gửi' }).click()
    await expect(replies).toHaveCount(2, { timeout: 15_000 })
    await expect(again.getByTestId('chat-reply')).toHaveCount(2)
    expect(errors).toEqual([])
  } finally {
    await deleteE2eUsers([user.id])
  }
})
