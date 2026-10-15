import 'server-only'

export type Email = { to: string; subject: string; html: string; text: string }

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** n***@example.com: log đủ để biết gửi cho ai mà không lộ cả địa chỉ */
export function maskEmail(email: string) {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'
  return `${email[0]}***${email.slice(at)}`
}

/**
 * Gửi email qua REST API của Resend (fetch, không SDK) khi có `RESEND_API_KEY` + `EMAIL_FROM`; chưa cấu hình thì chỉ
 * ghi log (dự án học tập chạy được không cần dịch vụ email). Không throw: email là phụ, lỗi chỉ ghi log. Gọi trong
 * `after()` để người dùng không phải chờ.
 */
export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const to = maskEmail(email.to)
  if (!key || !from) {
    console.info(`[email] chưa cấu hình RESEND_API_KEY / EMAIL_FROM, chỉ ghi log: to=${to} subject="${email.subject}"`)
    return
  }
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) console.error(`[email] Resend trả ${response.status} khi gửi tới ${to}: ${await response.text()}`)
  } catch (error) {
    console.error(`[email] không gửi được tới ${to}:`, error instanceof Error ? error.message : error)
  }
}
