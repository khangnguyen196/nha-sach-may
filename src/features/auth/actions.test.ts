import { beforeEach, describe, expect, it, vi } from 'vitest'

// requestPasswordReset (ux-messages mục 3): chỉ báo lỗi không nói gì về tài khoản; mọi trường hợp còn lại cùng một
// kết quả "đã gửi", để không dò được email nào có tài khoản. Supabase và Next đều giả lập.
const resetPasswordForEmail = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'http://localhost:3000' }) }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) => `${key} ${JSON.stringify(values)}`,
}))
vi.mock('@/i18n/navigation', () => ({ getPathname: () => '/', redirect: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { resetPasswordForEmail } }),
}))

const { requestPasswordReset } = await import('./actions')

const EMAIL = 'ban.doc@example.com'
const SENT = { ok: true, data: { email: EMAIL } }

function form(email = EMAIL) {
  const data = new FormData()
  data.set('email', email)
  return data
}

function authError(code: string, status: number, message = 'error') {
  return { name: 'AuthApiError', code, status, message }
}

describe('requestPasswordReset', () => {
  beforeEach(() => resetPasswordForEmail.mockReset())

  it('email không có tài khoản: GoTrue không báo lỗi → "đã gửi"', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    expect(await requestPasswordReset('vi', null, form())).toEqual(SENT)
    expect(resetPasswordForEmail).toHaveBeenCalledWith(EMAIL, {
      redirectTo: expect.stringContaining('/api/auth/confirm'),
    })
  })

  it('địa chỉ bị GoTrue từ chối vì sai dạng (email_address_invalid) → lỗi dưới ô Email', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: null, error: authError('email_address_invalid', 400) })
    expect(await requestPasswordReset('vi', null, form())).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      fieldErrors: { email: 'emailRejected' },
    })
  })

  it('email_address_not_authorized (chỉ xảy ra khi đã có tài khoản) → "đã gửi", giống email không có tài khoản', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: null, error: authError('email_address_not_authorized', 400) })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await requestPasswordReset('vi', null, form())).toEqual(SENT)
  })

  it('lỗi lạ khác (user_not_found…) → "đã gửi"', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: null, error: authError('user_not_found', 404) })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await requestPasswordReset('vi', null, form())).toEqual(SENT)
  })

  it('giới hạn tần suất / không tới được máy chủ vẫn báo (không nói gì về tài khoản)', async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: authError('over_email_send_rate_limit', 429, 'For security purposes, you can only request this after 42 seconds.'),
    })
    expect(await requestPasswordReset('vi', null, form())).toMatchObject({
      ok: false,
      code: 'RATE_LIMITED',
      details: { seconds: 42 },
    })

    resetPasswordForEmail.mockResolvedValue({ data: null, error: { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' } })
    expect(await requestPasswordReset('vi', null, form())).toEqual({ ok: false, code: 'NETWORK_ERROR' })
  })
})
