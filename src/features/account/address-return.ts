import type { Locale } from 'next-intl'
import { localizedPath, matchUsedListingBuyPath } from '@/i18n/paths'
import type { AddressReturnTo } from './schemas'

/** id tin trên URL: chỉ chữ số, không số 0 đứng đầu (số nguyên dương, kiểm thêm an toàn ở dưới) */
const LISTING_ID = /^[1-9]\d*$/

/**
 * `?next=` của trang thêm địa chỉ → nơi quay lại sau khi lưu. Chỉ nhận đúng URL trang thanh toán của locale đang xem
 * (link "Thêm địa chỉ" ở /thanh-toan) hoặc trang mua một tin sách cũ của CÙNG locale (link ở /cho-sach-cu/<id>/mua).
 * Mọi giá trị khác (đường dẫn lạ, locale khác, id sai dạng / quá lớn, lặp khóa ?next=a&next=b) → null: lưu xong về sổ
 * địa chỉ. Kết quả chỉ là loại trang + id: trang và action dựng lại URL từ mẫu route, không dùng chuỗi next thô.
 */
export function parseAddressNext(next: unknown, locale: Locale): AddressReturnTo {
  if (typeof next !== 'string') return null
  if (next === localizedPath('/checkout', locale)) return 'checkout'
  const buy = matchUsedListingBuyPath(next)
  if (!buy || buy.locale !== locale || !LISTING_ID.test(buy.id)) return null
  const id = Number(buy.id)
  return Number.isSafeInteger(id) ? { usedListingId: id } : null
}
