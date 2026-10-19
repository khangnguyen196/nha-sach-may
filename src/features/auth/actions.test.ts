import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Quên mật khẩu / gửi lại email xác nhận / đăng ký (docs/plans/ux-messages.md → "Bổ sung", docs/plans/sau-ux.md mục 1):
// chỉ báo lỗi khi không tới được máy chủ (hoặc zod chặn dữ liệu nhập; đăng ký: thêm các mã GoTrue kiểm trước khi tìm user).
// Mọi phản hồi khác của GoTrue cùng một kết quả "đã gửi", để không dò được email nào có tài khoản. Supabase và Next đều
// giả lập.
const resetPasswordForEmail = vi.fn()
const resend = vi.fn()
const signUpMock = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'http://localhost:3000' }) }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) => `${key} ${JSON.stringify(values)}`,
}))
vi.mock('@/i18n/navigation', () => ({ getPathname: () => '/', redirect: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { resetPasswordForEmail, resend, signUp: signUpMock } }),
}))

const { requestPasswordReset, resendConfirmation, signUp } = await import('./actions')

const EMAIL = 'ban.doc@example.com'

// Đủ ô của form đăng ký; 2 action kia chỉ đọc `email` (zod bỏ ô thừa)
function form(email = EMAIL) {
  const data = new FormData()
  data.set('email', email)
  data.set('full_name', 'Bạn Đọc')
  data.set('password', 'mat-khau-du-dai-1')
  return data
}

function authError(code: string, status: number, message = 'error') {
  return { name: 'AuthApiError', code, status, message }
}

// Đúng kiểu supabase-js trả cho 500–504 và 520–530 (auth-js lib/fetch.ts): AuthRetryableFetchError, có status, KHÔNG có
// code. Bản auth-js cũ chỉ coi 502–504 là retryable (500 thành AuthApiError unexpected_failure): giữ cả hai ca.
function retryable(status: number, message = 'Error sending recovery email') {
  return { name: 'AuthRetryableFetchError', status, message }
}

type GoTrueError = { name: string; status?: number; message: string; code?: string }

// Phản hồi của GoTrue mà nhiều cái chỉ xảy ra khi email ĐÃ có tài khoản → phải cùng một kết quả "đã gửi".
// Cột 3: dòng log mong đợi (mã lỗi, hoặc name + status khi không có mã), không bao giờ có email.
const SILENT: [name: string, error: GoTrueError | null, log: string | null][] = [
  ['email không có tài khoản (GoTrue trả 200, không lỗi)', null, null],
  ['email_address_invalid (GoTrue kiểm khi gửi thư, sau khi tìm thấy tài khoản)', authError('email_address_invalid', 400, `Email address "${EMAIL}" is invalid`), 'email_address_invalid'],
  ['email_address_not_authorized (SMTP mặc định chỉ gửi cho thành viên project)', authError('email_address_not_authorized', 400, `Email address "${EMAIL}" cannot be used as it is not authorized`), 'email_address_not_authorized'],
  ['429 theo từng tài khoản (gửi lại trong ~60 giây)', authError('over_email_send_rate_limit', 429, 'For security purposes, you can only request this after 42 seconds.'), 'over_email_send_rate_limit'],
  ['429 giới hạn email của project', authError('over_email_send_rate_limit', 429, 'Email rate limit exceeded'), 'over_email_send_rate_limit'],
  ['429 giới hạn request', authError('over_request_rate_limit', 429, 'Request rate limit reached'), 'over_request_rate_limit'],
  ['500 khi gửi thư (SMTP lỗi; supabase-js hiện tại: AuthRetryableFetchError, không code)', retryable(500), 'AuthRetryableFetchError 500'],
  ['500 khi gửi thư (auth-js cũ: AuthApiError unexpected_failure)', authError('unexpected_failure', 500, 'Error sending recovery email'), 'unexpected_failure'],
  ['503 (AuthRetryableFetchError, không code)', retryable(503, `Service unavailable for ${EMAIL}`), 'AuthRetryableFetchError 503'],
  ['lỗi không có status (AuthUnknownError)', { name: 'AuthUnknownError', message: `unknown ${EMAIL}` }, 'AuthUnknownError'],
  ['mã lạ', authError('something_new', 400), 'something_new'],
]

const NETWORK = { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' }

const ACTIONS = [
  {
    name: 'requestPasswordReset',
    label: 'resetPasswordForEmail:',
    mock: resetPasswordForEmail,
    run: (data: FormData) => requestPasswordReset('vi', null, data),
    sent: { ok: true, data: { email: EMAIL } },
    // `data` supabase-js trả kèm lỗi
    failedData: null,
  },
  {
    name: 'resendConfirmation',
    label: 'resend(signup):',
    mock: resend,
    run: (data: FormData) => resendConfirmation('vi', null, data),
    sent: { ok: true, data: null },
    failedData: null,
  },
  {
    name: 'signUp',
    label: 'signUp:',
    mock: signUpMock,
    run: (data: FormData) => signUp('vi', null, data),
    sent: { ok: true, data: { email: EMAIL } },
    failedData: { user: null, session: null },
  },
] as const

describe.each(ACTIONS)('$name', ({ label, mock, run, sent, failedData }) => {
  let logged: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mock.mockReset()
    logged = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it.each(SILENT)('%s → "đã gửi"', async (_name, error, log) => {
    mock.mockResolvedValue({ data: error ? failedData : {}, error })
    expect(await run(form())).toEqual(sent)
    // Log có mã lỗi thật, không có địa chỉ email (message của GoTrue có thể chứa email)
    if (log) {
      expect(logged).toHaveBeenCalledTimes(1)
      expect(logged).toHaveBeenCalledWith(label, log)
    } else {
      expect(logged).not.toHaveBeenCalled()
    }
    expect(JSON.stringify(logged.mock.calls)).not.toContain(EMAIL)
  })

  it('không tới được máy chủ (fetch lỗi) → NETWORK_ERROR', async () => {
    mock.mockResolvedValue({ data: failedData, error: NETWORK })
    expect(await run(form())).toEqual({ ok: false, code: 'NETWORK_ERROR' })
    expect(logged).not.toHaveBeenCalled()
  })

  it('email sai dạng: zod chặn ở server, không gọi GoTrue', async () => {
    expect(await run(form('khong-phai-email'))).toMatchObject({ ok: false, code: 'INVALID_INPUT' })
    expect(mock).not.toHaveBeenCalled()
  })
})

describe('signUp: riêng của đăng ký', () => {
  let logged: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    signUpMock.mockReset()
    logged = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('email đã có tài khoản (autoconfirm bật: user_already_exists) → "đã gửi" như đăng ký mới', async () => {
    signUpMock.mockResolvedValue({ data: { user: null, session: null }, error: authError('user_already_exists', 422, 'User already registered') })
    expect(await signUp('vi', null, form())).toEqual({ ok: true, data: { email: EMAIL } })
    expect(logged).toHaveBeenCalledWith('signUp:', 'user_already_exists')
  })

  // Mã GoTrue kiểm TRƯỚC khi tìm user (signup.go): không nói gì về tài khoản → vẫn báo
  it.each([
    ['weak_password → dưới ô Mật khẩu', authError('weak_password', 422, 'Password is known to be weak'), { ok: false, code: 'WEAK_PASSWORD', fieldErrors: { password: 'passwordWeak' } }],
    ['validation_failed → đầu form', authError('validation_failed', 400, 'Unable to validate email address: invalid format'), { ok: false, code: 'INVALID_INPUT' }],
    ['signup_disabled', authError('signup_disabled', 422, 'Signups not allowed for this instance'), { ok: false, code: 'SIGNUP_DISABLED' }],
    ['email_provider_disabled', authError('email_provider_disabled', 422, 'Email signups are disabled'), { ok: false, code: 'SIGNUP_DISABLED' }],
  ])('%s', async (_name, error, expected) => {
    signUpMock.mockResolvedValue({ data: { user: null, session: null }, error })
    expect(await signUp('vi', null, form())).toEqual(expected)
  })

  it('mật khẩu / họ tên sai: zod chặn, không gọi GoTrue', async () => {
    const data = form()
    data.set('password', 'ngan')
    data.set('full_name', '')
    expect(await signUp('vi', null, data)).toMatchObject({ ok: false, code: 'INVALID_INPUT' })
    expect(signUpMock).not.toHaveBeenCalled()
  })
})
