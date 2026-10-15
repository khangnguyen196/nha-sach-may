import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { getBankAccount } = await import('./bank')

const real = {
  VIETQR_BANK_BIN: '970422',
  VIETQR_BANK_NAME: 'MB Bank',
  VIETQR_ACCOUNT_NO: '123456789',
  VIETQR_ACCOUNT_NAME: 'NGUYEN VAN A',
}

describe('getBankAccount', () => {
  it('đủ 4 biến hợp lệ → thông tin thật, không demo', () => {
    expect(getBankAccount(real)).toEqual({
      bin: '970422',
      bankName: 'MB Bank',
      accountNo: '123456789',
      accountName: 'NGUYEN VAN A',
      demo: false,
    })
  })

  it('thiếu hoặc sai một biến → demo (không ghép nửa thật nửa demo)', () => {
    expect(getBankAccount({}).demo).toBe(true)
    expect(getBankAccount({ ...real, VIETQR_ACCOUNT_NAME: '' }).demo).toBe(true)
    expect(getBankAccount({ ...real, VIETQR_BANK_BIN: '9704' }).demo).toBe(true)
    expect(getBankAccount({ ...real, VIETQR_ACCOUNT_NO: '123-456' }).demo).toBe(true)
  })

  it('demo: số tài khoản không tồn tại ở ngân hàng nào', () => {
    expect(getBankAccount({}).accountNo).toMatch(/^0+$/)
  })
})
