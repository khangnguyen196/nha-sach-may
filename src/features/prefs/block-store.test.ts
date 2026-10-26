import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBlockedKeys, setBlockedKeys, subscribeBlockedKeys, syncBlockedKeys } from './block-store'
import type { ExpandedBlocks } from './blocks'

const A: ExpandedBlocks = { categoryIds: [1], authorIds: [], publisherIds: [], warnings: [] }
const B: ExpandedBlocks = { categoryIds: [], authorIds: [5], publisherIds: [3], warnings: ['adult'] }

afterEach(() => setBlockedKeys(null))

describe('block-store (mục chặn cho palette ⌘K)', () => {
  it('mặc định rỗng; set / đổi / về null, báo mọi subscriber mỗi lần', () => {
    expect(getBlockedKeys()).toBeNull()
    const first = vi.fn()
    const second = vi.fn()
    const unsubscribeFirst = subscribeBlockedKeys(first)
    const unsubscribeSecond = subscribeBlockedKeys(second)

    setBlockedKeys(A)
    expect(getBlockedKeys()).toBe(A)
    setBlockedKeys(B)
    expect(getBlockedKeys()).toBe(B)
    setBlockedKeys(null)
    expect(getBlockedKeys()).toBeNull()
    expect(first).toHaveBeenCalledTimes(3)
    expect(second).toHaveBeenCalledTimes(3)

    // Hủy đăng ký: không còn được báo, subscriber khác vẫn được báo
    unsubscribeFirst()
    setBlockedKeys(A)
    expect(first).toHaveBeenCalledTimes(3)
    expect(second).toHaveBeenCalledTimes(4)
    unsubscribeSecond()
  })

  it('vòng đời effect của RevealBlocked: gắn → đổi props → unmount', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeBlockedKeys(listener)

    // Gắn với props A (BlockStyles stream xong)
    const cleanupA = syncBlockedKeys(A)
    expect(getBlockedKeys()).toBe(A)
    // Chặn thêm → refresh() → props B: React chạy cleanup của A rồi effect với B
    cleanupA()
    const cleanupB = syncBlockedKeys(B)
    expect(getBlockedKeys()).toBe(B)
    // Bỏ chặn hết / đăng xuất → BlockStyles trả null → unmount: chỉ cleanup
    cleanupB()
    expect(getBlockedKeys()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(4)
    unsubscribe()
  })

  it('RevealBlocked chạy effect theo props `expanded` (deps có expanded), không chỉ lúc gắn', () => {
    const source = readFileSync(new URL('./components/reveal-blocked.tsx', import.meta.url), 'utf8')
    expect(source).toContain('useEffect(() => syncBlockedKeys(expanded), [expanded])')
    // Chỉ import KIỂU từ blocks.ts (chunk layout của mọi route không kéo labels / Constants)
    expect(source).toMatch(/^import type \{ ExpandedBlocks \} from '\.\.\/blocks'$/m)
    expect(source).not.toMatch(/^import \{[^}]*\} from '\.\.\/blocks'$/m)
    const store = readFileSync(new URL('./block-store.ts', import.meta.url), 'utf8')
    expect(store).toMatch(/^import type \{ ExpandedBlocks \} from '\.\/blocks'$/m)
    expect(store).not.toMatch(/^import \{[^}]*\} from '\.\/blocks'$/m)
  })
})
