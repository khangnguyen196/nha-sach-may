// Nháp ghi chú ở trang thanh toán trong tab này (sessionStorage): áp mã giảm giá / chọn địa chỉ khác là form GET tải
// lại trang, không để mất chữ đã gõ. Khóa gắn tài khoản: cùng tab, người đăng nhập sau không thấy nháp của người trước.
// Chỉ lưu chữ ghi chú. Module không import gì: dùng được ở form thanh toán và form đăng xuất.
const PREFIX = 'checkout-note-draft'

const keyFor = (userId: string) => `${PREFIX}:${userId}`

export function readNoteDraft(userId: string) {
  try {
    return sessionStorage.getItem(keyFor(userId)) ?? ''
  } catch {
    return ''
  }
}

export function writeNoteDraft(userId: string, value: string) {
  try {
    if (value) sessionStorage.setItem(keyFor(userId), value)
    else sessionStorage.removeItem(keyFor(userId))
  } catch {
    // sessionStorage bị chặn → chỉ mất tiện ích giữ nháp
  }
}

/** Xóa mọi nháp ghi chú của tab (kể cả khóa cũ không gắn tài khoản), trừ nháp của `keepUserId` nếu có */
export function clearNoteDrafts(keepUserId?: string) {
  try {
    const keep = keepUserId ? keyFor(keepUserId) : null
    const keys = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
    for (const key of keys) {
      if (key?.startsWith(PREFIX) && key !== keep) sessionStorage.removeItem(key)
    }
  } catch {
    // sessionStorage bị chặn → không có nháp nào để xóa
  }
}
