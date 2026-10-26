import { useSyncExternalStore } from 'react'
import type { ExpandedBlocks } from './blocks'

// Mục chặn đã mở rộng của người đang xem, chia sẻ ở client cho palette ⌘K (docs/plans/so-thich-canh-bao.md P-C, quyết
// định (12)). RevealBlocked (layout, nhận từ BlockStyles sau khi đọc phiên) ghi vào; unmount (khách, bỏ chặn hết, đăng
// xuất) → null. Chỉ id số + nhãn enum, không chữ người dùng nhập. Chỉ import KIỂU từ blocks.ts: module này nằm trong
// chunk của layout (mọi route), không kéo labels / Constants theo.

let current: ExpandedBlocks | null = null
const listeners = new Set<() => void>()

export function setBlockedKeys(next: ExpandedBlocks | null) {
  current = next
  for (const listener of listeners) listener()
}

export function getBlockedKeys(): ExpandedBlocks | null {
  return current
}

export function subscribeBlockedKeys(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Thân effect của RevealBlocked (`useEffect(() => syncBlockedKeys(expanded), [expanded])`): ghi mục chặn, trả cleanup về
 * null. React chạy cleanup của props cũ rồi mới chạy với props mới; unmount chỉ chạy cleanup → store rỗng.
 */
export function syncBlockedKeys(expanded: ExpandedBlocks) {
  setBlockedKeys(expanded)
  return () => setBlockedKeys(null)
}

const serverSnapshot = () => null

/** Mục chặn hiện tại; null khi chưa có (khách, chưa chặn gì, BlockStyles chưa stream xong) */
export function useBlockedKeys(): ExpandedBlocks | null {
  return useSyncExternalStore(subscribeBlockedKeys, getBlockedKeys, serverSnapshot)
}
