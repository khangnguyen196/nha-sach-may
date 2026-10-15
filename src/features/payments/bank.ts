import 'server-only'

export type BankAccount = {
  /** Mã BIN 6 số của ngân hàng (NAPAS) */
  bin: string
  bankName: string
  accountNo: string
  accountName: string
  /** true = thông tin demo của dự án học tập: luôn hiện cảnh báo "đừng chuyển tiền thật" */
  demo: boolean
}

/**
 * Tài khoản nhận chuyển khoản. Dự án học tập: mặc định là thông tin **demo** (số tài khoản toàn số 0, app ngân hàng
 * báo không tồn tại), luôn kèm cảnh báo. Chủ dự án muốn nhận tiền thật thì đặt đủ 4 biến (server-only, không
 * NEXT_PUBLIC_): VIETQR_BANK_BIN, VIETQR_BANK_NAME, VIETQR_ACCOUNT_NO, VIETQR_ACCOUNT_NAME (docs/plans/owner-todo.md).
 */
export function getBankAccount(env: Record<string, string | undefined> = process.env): BankAccount {
  const bin = env.VIETQR_BANK_BIN?.trim()
  const bankName = env.VIETQR_BANK_NAME?.trim()
  const accountNo = env.VIETQR_ACCOUNT_NO?.trim()
  const accountName = env.VIETQR_ACCOUNT_NAME?.trim()
  if (bin && /^\d{6}$/.test(bin) && bankName && accountNo && /^[0-9A-Za-z]{1,19}$/.test(accountNo) && accountName) {
    return { bin, bankName, accountNo, accountName, demo: false }
  }
  return { bin: '970436', bankName: 'Vietcombank (DEMO)', accountNo: '0000000000', accountName: 'NHA SACH MAY DEMO', demo: true }
}
