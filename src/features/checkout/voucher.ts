/** Mã voucher: chữ không dấu, số, gạch ngang, gạch dưới; cột `vouchers.code` có check `code = upper(code)`. Dùng chung admin + checkout. */
export const VOUCHER_CODE = /^[A-Z0-9_-]{3,30}$/

/** Ô mã giảm giá: trống (null), mã đúng dạng, hoặc chữ khách gõ sai dạng (báo "không có mã này" dưới ô) */
export type VoucherInput = { code: string } | { invalid: string } | null

/**
 * Mã voucher từ URL (`/thanh-toan?voucher=…`): lấy giá trị đầu nếu lặp key, bỏ khoảng trắng, viết HOA.
 * Không throw: URL do người dùng sửa tay không được làm vỡ trang. Sai dạng (có dấu, quá ngắn…) vẫn trả lại để báo lỗi
 * thay vì lặng lẽ bỏ qua (cắt 30 ký tự như ô nhập).
 */
export function parseVoucherInput(value: unknown): VoucherInput {
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first !== 'string') return null
  const code = first.trim().toUpperCase()
  if (!code) return null
  return VOUCHER_CODE.test(code) ? { code } : { invalid: code.slice(0, 30) }
}

/** Mã hợp lệ hoặc null (form đặt hàng: hidden `voucher_code` chỉ chứa mã đã áp dụng) */
export function normalizeVoucherCode(value: unknown): string | null {
  const input = parseVoucherInput(value)
  return input && 'code' in input ? input.code : null
}
