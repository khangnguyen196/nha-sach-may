'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { mergeGuestCart } from '../actions'
import { readGuestCart, setUserCartCount, writeGuestCart } from '../store'

const MERGE_LOCK = 'nsm-cart-merge'

// 'elsewhere': lúc vào khóa giỏ đã rỗng → tab khác vừa gộp xong, tab này cũng cần tải lại số trên badge
type Outcome = 'merged' | 'elsewhere' | 'failed'

/** Đọc lại localStorage trong khóa; gộp xong xóa luôn (trước khi nhả khóa) */
async function mergeOnce(): Promise<Outcome> {
  const items = readGuestCart()
  if (items.length === 0) return 'elsewhere'
  const result = await mergeGuestCart(items)
  if (!result.ok) {
    console.error('mergeGuestCart:', result.code)
    return 'failed'
  }
  writeGuestCart([])
  setUserCartCount(result.data.count)
  return 'merged'
}

// Không có navigator.locks: chặn chạy chồng trong cùng tab (effect chạy 2 lần ở dev); giữa các tab thì không chặn được
let inFlight: Promise<Outcome> | null = null

async function mergeGuestCartLocked(): Promise<Outcome> {
  // Nhiều tab cùng mở sau khi đăng nhập: tab nào cũng thấy localStorage có hàng. Khóa theo origin → tab sau
  // chờ tab trước gộp + xóa xong rồi mới đọc lại, thấy rỗng thì bỏ qua → số lượng không bị cộng hai lần.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    // Kiểu của lib.dom bọc kết quả callback async thành Promise<Promise<T>>; lúc chạy chỉ là Promise<T>
    return await navigator.locks.request(MERGE_LOCK, mergeOnce)
  }
  inFlight ??= mergeOnce().finally(() => {
    inFlight = null
  })
  return inFlight
}

/**
 * Gộp giỏ khách (localStorage) vào giỏ tài khoản ngay khi có phiên. Nằm ở header nên bao mọi đường vào phiên:
 * form đăng nhập, link xác nhận email, đặt lại mật khẩu. Lỗi → giữ localStorage, lần tải trang sau thử lại.
 */
export function CartSync() {
  const router = useRouter()

  useEffect(() => {
    if (readGuestCart().length === 0) return
    let active = true
    mergeGuestCartLocked()
      .then((outcome) => {
        if (outcome !== 'failed' && active) router.refresh()
      })
      .catch((error: unknown) => console.error('CartSync:', error))
    return () => {
      active = false
    }
  }, [router])

  return null
}
