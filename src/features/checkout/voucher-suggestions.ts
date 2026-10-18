import type { Database } from '@/types/database'

type RpcRow = Database['public']['Functions']['checkout_vouchers']['Returns'][number]

/**
 * Một dòng của RPC checkout_vouchers. Hàm RETURNS TABLE: types sinh tự động ghi mọi cột là không null, nhưng
 * description*, max_discount, ends_at, discount (chưa đủ tối thiểu) có thể null → coi mọi cột là có thể null.
 */
export type CheckoutVoucherRow = { [K in keyof RpcRow]: RpcRow[K] | null }

/** Mã đủ điều kiện với giỏ hiện tại (kèm mức giảm thật do DB tính) hoặc chưa đủ (kèm số tiền còn thiếu) */
export type RankedVoucher =
  | { row: CheckoutVoucherRow; code: string; eligible: true; discount: number }
  | { row: CheckoutVoucherRow; code: string; eligible: false; shortfall: number }

function classify(row: CheckoutVoucherRow): RankedVoucher[] {
  if (!row.code) return []
  const shortfall = row.shortfall ?? 0
  if (shortfall > 0) return [{ row, code: row.code, eligible: false, shortfall }]
  // Đủ tối thiểu thì DB luôn trả mức giảm; thiếu là dữ liệu lạ → không gợi ý
  return row.discount === null ? [] : [{ row, code: row.code, eligible: true, discount: row.discount }]
}

function compare(a: RankedVoucher, b: RankedVoucher) {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
  if (a.eligible && b.eligible && a.discount !== b.discount) return b.discount - a.discount
  if (!a.eligible && !b.eligible && a.shortfall !== b.shortfall) return a.shortfall - b.shortfall
  return a.code.localeCompare(b.code)
}

/** Mã đủ điều kiện lên đầu (giảm nhiều nhất trước), rồi mã chưa đủ (còn thiếu ít nhất trước) */
export function rankVouchers(rows: CheckoutVoucherRow[]): RankedVoucher[] {
  return rows.flatMap(classify).sort(compare)
}

/** Chuỗi của một thẻ mã: đã dịch ở server, client leaf chỉ hiện */
export type VoucherCard = {
  code: string
  benefit: string
  note: string | null
  condition: string
  expires: string
  /** null = đủ điều kiện (bấm "Áp dụng" được); có = lý do chưa dùng được */
  reason: string | null
}

type CardText = {
  t: (key: VoucherCardKey, values?: Record<string, string | number>) => string
  price: (value: number) => string
  date: (iso: string) => string
  note: (row: CheckoutVoucherRow) => string | null
}

export type VoucherCardKey =
  | 'voucherPercent'
  | 'voucherPercentCapped'
  | 'voucherFixed'
  | 'voucherMinOrder'
  | 'voucherNoMin'
  | 'voucherExpires'
  | 'voucherNoExpiry'
  | 'voucherShortfall'

export function voucherCard(voucher: RankedVoucher, { t, price, date, note }: CardText): VoucherCard {
  const { row } = voucher
  const value = row.discount_value ?? 0
  const benefit =
    row.discount_type === 'fixed'
      ? t('voucherFixed', { amount: price(value) })
      : row.max_discount
        ? t('voucherPercentCapped', { value, max: price(row.max_discount) })
        : t('voucherPercent', { value })
  const min = row.min_order_value ?? 0
  return {
    code: voucher.code,
    benefit,
    note: note(row),
    condition: min > 0 ? t('voucherMinOrder', { amount: price(min) }) : t('voucherNoMin'),
    expires: row.ends_at ? t('voucherExpires', { date: date(row.ends_at) }) : t('voucherNoExpiry'),
    reason: voucher.eligible ? null : t('voucherShortfall', { amount: price(voucher.shortfall) }),
  }
}
