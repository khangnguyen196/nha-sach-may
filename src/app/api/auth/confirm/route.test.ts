import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Route thật, Supabase giả: nhánh ?code= (template email mặc định) không tạo được bằng admin generateLink
// (link admin là implicit flow, token nằm sau #) nên kiểm tra phần đổi code ở đây; e2e kiểm tra các nhánh lỗi.
const exchangeCodeForSession = vi.fn()
const verifyOtp = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession, verifyOtp } }),
}))

const { GET } = await import('./route')

const CODE = '0b6f1c1e-6a59-4f7e-9d43-3f7f2b8f2a10'
const get = async (query: string) => {
  const response = await GET(new NextRequest(`https://example.com/api/auth/confirm?${query}`))
  return { status: response.status, location: response.headers.get('location') }
}

beforeEach(() => {
  exchangeCodeForSession.mockReset()
  verifyOtp.mockReset()
})

describe('GET /api/auth/confirm ?code= (template mặc định)', () => {
  it('đặt lại mật khẩu: đổi code → trang đặt mật khẩu mới theo next', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const { location } = await get(`code=${CODE}&locale=en&type=recovery&next=%2Fen%2Freset-password`)
    expect(exchangeCodeForSession).toHaveBeenCalledWith(CODE)
    expect(location).toBe('https://example.com/en/reset-password')
  })

  it('xác nhận đăng ký: thiếu next → trang tài khoản; next ra ngoài site → bỏ (safeNextPath)', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    expect((await get(`code=${CODE}&type=signup`)).location).toBe('https://example.com/tai-khoan')
    expect((await get(`code=${CODE}&type=signup&next=%2F%2Fevil.com`)).location).toBe('https://example.com/tai-khoan')
  })

  it('đổi code lỗi: đặt lại mật khẩu → yêu cầu link mới; đăng ký mở ở trình duyệt khác → đăng nhập bằng tay', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { code: 'pkce_code_verifier_not_found' } })
    expect((await get(`code=${CODE}&type=recovery`)).location).toBe(
      'https://example.com/quen-mat-khau?error=LINK_EXPIRED',
    )
    expect((await get(`code=${CODE}&type=signup&locale=en`)).location).toBe('https://example.com/en/login?confirmed=1')

    exchangeCodeForSession.mockResolvedValue({ error: { code: 'flow_state_expired' } })
    expect((await get(`code=${CODE}&type=signup`)).location).toBe('https://example.com/dang-nhap?error=LINK_EXPIRED')
  })

  it('Supabase báo link hết hạn (?error_code=) → trang yêu cầu lại, không gọi Supabase', async () => {
    expect((await get('error=access_denied&error_code=otp_expired&type=recovery')).location).toBe(
      'https://example.com/quen-mat-khau?error=LINK_EXPIRED',
    )
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })
})

describe('GET /api/auth/confirm ?token_hash= (template riêng)', () => {
  it('chỉ chuyển sang trang trung gian, không tiêu thụ token', async () => {
    const { location } = await get('token_hash=abc12345&type=email&locale=en')
    expect(location).toBe('https://example.com/en/confirm?token_hash=abc12345&type=email')
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })
})
