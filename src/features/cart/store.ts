import { useSyncExternalStore } from 'react'
import { countItems, parseGuestCart } from './guest-cart'
import type { CartItem } from './schemas'

// Trạng thái giỏ phía client, không thư viện (useSyncExternalStore). Chỉ import từ client component.
// - Giỏ khách: localStorage, đồng bộ giữa các tab qua sự kiện `storage`, trong tab qua sự kiện nội bộ.
// - Phiên: header (CartBadge) đặt `mode` sau khi đọc phiên ở server; trang sách prerender nên nút
//   "Thêm vào giỏ" không tự biết người dùng là khách hay đã đăng nhập.

const GUEST_CART_KEY = 'nsm-cart-v1'
const CHANGE_EVENT = 'nsm-cart-change'
const EMPTY: CartItem[] = []

// ---- Giỏ khách ----

// Safari private / storage bị chặn: getItem/setItem có thể ném lỗi
function readRaw(): string | null {
  try {
    return localStorage.getItem(GUEST_CART_KEY)
  } catch {
    return null
  }
}

// getSnapshot phải trả cùng tham chiếu khi dữ liệu không đổi → nhớ theo chuỗi thô
let cachedRaw: string | null = null
let cachedItems: CartItem[] = EMPTY

function getGuestSnapshot(): CartItem[] {
  const raw = readRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedItems = parseGuestCart(raw)
  }
  return cachedItems
}

function subscribeGuest(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === GUEST_CART_KEY || event.key === null) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

/** Server snapshot rỗng → HTML server và lần hydrate đầu khớp nhau, số thật hiện ngay sau đó */
export function useGuestCart(): CartItem[] {
  return useSyncExternalStore(subscribeGuest, getGuestSnapshot, () => EMPTY)
}

/** Đọc thẳng localStorage (không qua cache), VD trong khóa gộp giỏ */
export function readGuestCart(): CartItem[] {
  return parseGuestCart(readRaw())
}

/** false: trình duyệt không cho ghi (storage bị chặn / đầy) */
export function writeGuestCart(items: readonly CartItem[]): boolean {
  let saved = true
  try {
    if (items.length === 0) localStorage.removeItem(GUEST_CART_KEY)
    else localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
  } catch {
    saved = false
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return saved
}

// ---- Phiên ----

export type CartMode = 'unknown' | 'guest' | 'user'
/** serverCount null: không đếm được (query lỗi) → badge không hiện số */
type Session = { mode: CartMode; serverCount: number | null; pendingAdds: number }

const INITIAL_SESSION: Session = { mode: 'unknown', serverCount: 0, pendingAdds: 0 }
let session = INITIAL_SESSION
const listeners = new Set<() => void>()

function updateSession(patch: Partial<Session>) {
  session = { ...session, ...patch }
  for (const listener of listeners) listener()
}

function subscribeSession(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function useCartSession(): Session {
  return useSyncExternalStore(subscribeSession, () => session, () => INITIAL_SESSION)
}

export function getCartMode(): CartMode {
  return session.mode
}

/** Header gọi sau khi đọc phiên; `count` = tổng số cuốn trong giỏ tài khoản */
export function setCartSession(signedIn: boolean, count: number | null) {
  if (session.mode === (signedIn ? 'user' : 'guest') && session.serverCount === count) return
  updateSession({ mode: signedIn ? 'user' : 'guest', serverCount: count })
}

/** Số trên badge tăng ngay khi bấm thêm (optimistic), chốt bằng số server trả về hoặc lùi lại khi lỗi */
export function beginUserAdd() {
  updateSession({ pendingAdds: session.pendingAdds + 1 })
}

export function endUserAdd(count: number | null) {
  updateSession({ pendingAdds: session.pendingAdds - 1, ...(count === null ? {} : { serverCount: count }) })
}

export function setUserCartCount(count: number | null) {
  updateSession({ serverCount: count })
}

/** Tổng số cuốn hiện trên badge; null khi chưa biết phiên */
export function useCartCount(): number | null {
  const current = useCartSession()
  const guest = useGuestCart()
  if (current.mode === 'user') return current.serverCount === null ? null : current.serverCount + current.pendingAdds
  if (current.mode === 'guest') return countItems(guest)
  return null
}
