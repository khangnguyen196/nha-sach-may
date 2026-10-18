import { expect, type Locator, type Page } from '@playwright/test'
import { waitForHydration } from './helpers'

// Chatbot Mây trên e2e: server chạy AI giả (CHAT_AI_MOCK=1, playwright.config.ts), không bao giờ gọi Gemini thật.
// AI giả trả 3 ứng viên đầu; cụm [mock:…] trong câu hỏi điều khiển lỗi giả (src/features/chat/mock.ts).

export const CONFIRM_AGE = 'Tôi từ 18 tuổi trở lên, bắt đầu hỏi Mây'

// Bong bóng nằm trong <Suspense>: ngay sau hydrate React có thể còn giữ bản sao ẩn của boundary
// (<div hidden id="S:…">), nên bỏ mọi phần tử nằm trong [hidden]
const BUBBLE = '[data-testid="chat-bubble"]:not([hidden] *)'

export const bubble = (page: Page) => page.locator(BUBBLE)

export async function openChat(page: Page, { confirm = true } = {}) {
  await waitForHydration(page, BUBBLE)
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
