import { expect } from '@playwright/test'
import { loadLocalSupabase } from '../scripts/e2e-env'

// Hộp thư giả Mailpit của Supabase local: Auth gửi thư xác nhận / đặt lại mật khẩu vào đây (supabase/config.toml).
// API: https://mailpit.axllent.org/docs/api-v1/

type Summary = { ID: string; Subject: string }

async function mailpit<T>(path: string): Promise<T> {
  const response = await fetch(`${loadLocalSupabase().mailUrl}${path}`)
  if (!response.ok) throw new Error(`Mailpit ${path}: HTTP ${response.status}`)
  const body: T = await response.json()
  return body
}

/**
 * Thư mới nhất gửi tới `email` (chờ tối đa 15 s tới khi hộp thư có ít nhất `count` thư): tiêu đề + link
 * /api/auth/confirm trong thân thư
 */
export async function waitForAuthEmail(email: string, { count = 1 }: { count?: number } = {}) {
  let latest: Summary | undefined
  await expect
    .poll(
      async () => {
        const result = await mailpit<{ messages: Summary[] }>(`/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
        latest = result.messages.length >= count ? result.messages[0] : undefined
        return latest !== undefined
      },
      { timeout: 15_000, message: `Không có thư gửi tới ${email}` },
    )
    .toBe(true)
  if (!latest) throw new Error(`Không có thư gửi tới ${email}`)

  const message = await mailpit<{ HTML: string }>(`/api/v1/message/${latest.ID}`)
  const href = /href="([^"]*\/api\/auth\/confirm\?[^"]*)"/.exec(message.HTML)?.[1]
  if (!href) throw new Error(`Thư "${latest.Subject}" không có link /api/auth/confirm`)
  return { subject: latest.Subject, link: href.replaceAll('&amp;', '&') }
}
