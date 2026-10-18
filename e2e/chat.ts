import { expect, type Locator, type Page } from '@playwright/test'

// Chatbot Mây trên e2e: server chạy AI giả (CHAT_AI_MOCK=1, playwright.config.ts), không bao giờ gọi Gemini thật.
// AI giả trả 3 ứng viên đầu; cụm [mock:…] trong câu hỏi điều khiển lỗi giả (src/features/chat/mock.ts).

export const CONFIRM_AGE = 'Tôi từ 18 tuổi trở lên, bắt đầu hỏi Mây'

// Theo vai trò + tên (cây accessibility): bỏ qua bản sao không hiển thị của bong bóng nếu có (xem báo cáo Phase 11)
export const bubble = (page: Page) => page.getByRole('button', { name: 'Hỏi Mây gợi ý sách' })

export async function openChat(page: Page, { confirm = true } = {}) {
  await expect(bubble(page)).toBeVisible()
  // Chờ React gắn handler lên đúng nút đang hiển thị (bấm trước hydrate thì không mở)
  await expect
    .poll(() => bubble(page).evaluate((element) => Object.keys(element).some((key) => key.startsWith('__reactProps'))))
    .toBe(true)
  await bubble(page).click()
  const panel = page.getByTestId('chat-panel')
  await expect(panel).toBeVisible()
  if (confirm) await panel.getByRole('button', { name: CONFIRM_AGE }).click()
  return panel
}

const answers = (panel: Locator) => panel.locator('[data-testid="chat-reply"], [data-testid="chat-error"]')

/** Gửi một câu, chờ đúng một câu trả lời (hoặc khối lỗi) mới */
export async function ask(panel: Locator, text: string) {
  const before = await answers(panel).count()
  await panel.getByLabel('Câu hỏi cho Mây').fill(text)
  await panel.getByRole('button', { name: 'Gửi' }).click()
  await expect(answers(panel)).toHaveCount(before + 1, { timeout: 15_000 })
  return answers(panel).last()
}
