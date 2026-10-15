/** Mã voucher: chữ không dấu, số, gạch ngang, gạch dưới; cột `vouchers.code` có check `code = upper(code)`. Dùng chung admin + checkout. */
export const VOUCHER_CODE = /^[A-Z0-9_-]{3,30}$/

/**
 * Mã voucher từ URL (`/thanh-toan?voucher=…`) hoặc form: lấy giá trị đầu nếu lặp key, bỏ khoảng trắng, viết HOA.
 * Sai dạng → null (coi như không nhập mã), không throw: URL do người dùng sửa tay không được làm vỡ trang.
 */
export function normalizeVoucherCode(value: unknown): string | null {
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first !== 'string') return null
  const code = first.trim().toUpperCase()
  return VOUCHER_CODE.test(code) ? code : null
}
