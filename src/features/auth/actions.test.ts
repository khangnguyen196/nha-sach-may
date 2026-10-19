import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Quên mật khẩu / gửi lại email xác nhận (docs/plans/ux-messages.md → "Bổ sung", quyết định 2026-10-19): chỉ báo lỗi khi
// không tới được máy chủ (hoặc zod chặn dữ liệu nhập). Mọi phản hồi khác của GoTrue cùng một kết quả "đã gửi", để không
// dò được email nào có tài khoản. Supabase và Next đều giả lập.
const resetPasswordForEmail = vi.fn()
const resend = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'http://localhost:3000' }) }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) => `${key} ${JSON.stringify(values)}`,
}))
vi.mock('@/i18n/navigation', () => ({ getPathname: () => '/', redirect: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { resetPasswordForEmail, resend } }),
}))

const { requestPasswordReset, resendConfirmation } = await import('./actions')

const EMAIL = 'ban.doc@example.com'

function form(email = EMAIL) {
  const data = new FormData()
  data.set('email', email)
  return data
}

function authError(code: string, status: number, message = 'error') {
  return { name: 'AuthApiError', code, status, message }
}

// Phản hồi của GoTrue mà nhiều cái chỉ xảy ra khi email ĐÃ có tài khoản → phải cùng một kết quả "đã gửi"
const SILENT: [name: string, error: ReturnType<typeof authError> | null][] = [
  ['email không có tài khoản (GoTrue trả 200, không lỗi)', null],
  ['email_address_invalid (GoTrue kiểm khi gửi thư, sau khi tìm thấy tài khoản)', authError('email_address_invalid', 400, `Email address "${EMAIL}" is invalid`)],
  ['email_address_not_authorized (SMTP mặc định chỉ gửi cho thành viên project)', authError('email_address_not_authorized', 400, `Email address "${EMAIL}" cannot be used as it is not authorized`)],
  ['429 theo từng tài khoản (gửi lại trong ~60 giây)', authError('over_email_send_rate_limit', 429, 'For security purposes, you can only request this after 42 seconds.')],
  ['429 giới hạn email của project', authError('over_email_send_rate_limit', 429, 'Email rate limit exceeded')],
  ['429 giới hạn request', authError('over_request_rate_limit', 429, 'Request rate limit reached')],
  ['5xx khi gửi thư (SMTP lỗi)', authError('unexpected_failure', 500, 'Error sending recovery email')],
  ['mã lạ', authError('something_new', 400)],
]

const NETWORK = { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' }

const ACTIONS = [
  {
    name: 'requestPasswordReset',
    mock: resetPasswordForEmail,
    run: (data: FormData) => requestPasswordReset('vi', null, data),
    sent: { ok: true, data: { email: EMAIL } },
  },
  {
    name: 'resendConfirmation',
    mock: resend,
    run: (data: FormData) => resendConfirmation('vi', null, data),
    sent: { ok: true, data: null },
  },
] as const

describe.each(ACTIONS)('$name', ({ mock, run, sent }) => {
  let logged: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mock.mockReset()
    logged = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it.each(SILENT)('%s → "đã gửi"', async (_name, error) => {
    mock.mockResolvedValue({ data: error ? null : {}, error })
    expect(await run(form())).toEqual(sent)
    // Log có mã lỗi thật, không có địa chỉ email (message của GoTrue có thể chứa email)
    if (error) expect(logged).toHaveBeenCalledWith(expect.any(String), error.code)
    expect(JSON.stringify(logged.mock.calls)).not.toContain(EMAIL)
  })

  it('không tới được máy chủ (fetch lỗi) → NETWORK_ERROR', async () => {
    mock.mockResolvedValue({ data: null, error: NETWORK })
    expect(await run(form())).toEqual({ ok: false, code: 'NETWORK_ERROR' })
  })

  it('email sai dạng: zod chặn ở server, không gọi GoTrue', async () => {
    expect(await run(form('khong-phai-email'))).toMatchObject({ ok: false, code: 'INVALID_INPUT' })
    expect(mock).not.toHaveBeenCalled()
  })
})
