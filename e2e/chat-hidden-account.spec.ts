import { expect, test } from '@playwright/test'
import { createE2eUser, deleteE2eUsers, setCartItem } from '../scripts/e2e-user'
import { login, NO_SESSION, readShopBooks } from './auth'
import { bubble, openChat } from './chat'

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
