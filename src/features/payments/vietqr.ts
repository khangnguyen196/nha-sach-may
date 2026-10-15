/**
 * Payload VietQR (chuẩn EMVCo Merchant-Presented QR của NAPAS): app ngân hàng quét ra sẵn ngân hàng, số tài khoản,
 * số tiền và nội dung chuyển khoản. Hàm thuần, không gọi dịch vụ ngoài; vẽ QR ở `components/vietqr-card.tsx`.
 *
 * Cấu trúc (mỗi trường = ID 2 số + độ dài 2 số + giá trị):
 *   00 "01"                       phiên bản payload
 *   01 "12"                       QR động (có số tiền, dùng một lần cho một đơn)
 *   38 { 00 "A000000727"          GUID của NAPAS
 *        01 { 00 BIN, 01 số TK }  ngân hàng thụ hưởng
 *        02 "QRIBFTTA" }          dịch vụ: chuyển nhanh tới tài khoản
 *   53 "704"                      VND
 *   54 số tiền                    số nguyên, không dấu phân cách
 *   58 "VN"
 *   62 { 08 nội dung }            nội dung chuyển khoản = mã đơn
 *   63 CRC                        CRC-16/CCITT-FALSE của toàn bộ chuỗi trước nó + "6304", 4 ký tự hex HOA
 */

export type VietQrInput = {
  /** Mã BIN 6 số của ngân hàng (NAPAS) */
  bankBin: string
  accountNo: string
  /** VND, số nguyên dương */
  amount: number
  /** Nội dung chuyển khoản: chữ không dấu, số, khoảng trắng (app ngân hàng bỏ ký tự lạ) */
  description: string
}

const NAPAS_GUID = 'A000000727'
const SERVICE_TO_ACCOUNT = 'QRIBFTTA'
const MAX_FIELD_LENGTH = 99

function field(id: string, value: string) {
  if (value.length > MAX_FIELD_LENGTH) throw new Error(`VietQR: trường ${id} dài quá ${MAX_FIELD_LENGTH} ký tự`)
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

/** CRC-16/CCITT-FALSE: đa thức 0x1021, giá trị đầu 0xFFFF, không đảo bit (EMVCo QR, mục 4.7.3) */
export function crc16(input: string): string {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function buildVietQrPayload({ bankBin, accountNo, amount, description }: VietQrInput): string {
  if (!/^\d{6}$/.test(bankBin)) throw new Error('VietQR: BIN ngân hàng phải là 6 chữ số')
  if (!/^[0-9A-Za-z]{1,19}$/.test(accountNo)) throw new Error('VietQR: số tài khoản không hợp lệ')
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('VietQR: số tiền phải là số nguyên dương')
  if (!/^[0-9A-Za-z ]{1,25}$/.test(description)) throw new Error('VietQR: nội dung chỉ gồm chữ không dấu, số, khoảng trắng')

  const beneficiary = field('00', bankBin) + field('01', accountNo)
  const body =
    field('00', '01') +
    field('01', '12') +
    field('38', field('00', NAPAS_GUID) + field('01', beneficiary) + field('02', SERVICE_TO_ACCOUNT)) +
    field('53', '704') +
    field('54', String(amount)) +
    field('58', 'VN') +
    field('62', field('08', description))
  const withCrcHeader = `${body}6304`
  return withCrcHeader + crc16(withCrcHeader)
}
