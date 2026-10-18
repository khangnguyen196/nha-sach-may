import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import vi from '../../messages/vi.json'
import { GLOBAL_ERROR_MESSAGES } from './global-error-messages'
import { localizedPath } from './paths'

function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key))
}

describe('messages', () => {
  it('vi.json và en.json có cùng bộ key (trừ namespace admin và chat, chỉ tiếng Việt)', () => {
    const { admin, chat, ...shared } = vi
    expect(keyPaths(en).sort()).toEqual(keyPaths(shared).sort())
    expect(keyPaths(admin).length).toBeGreaterThan(0)
    expect(keyPaths(chat).length).toBeGreaterThan(0)
    expect(Object.keys(en)).not.toContain('admin')
    expect(Object.keys(en)).not.toContain('chat')
  })

  it('chuỗi của global-error khớp namespace errorPage', () => {
    for (const [locale, messages] of [['vi', vi], ['en', en]] as const) {
      const { homeHref, ...strings } = GLOBAL_ERROR_MESSAGES[locale]
      expect(strings).toEqual(messages.errorPage)
      expect(homeHref).toBe(localizedPath('/', locale))
    }
  })

  it('không có chuỗi rỗng', () => {
    for (const messages of [vi, en]) {
      const empty = keyPaths(messages).filter((path) => {
        const leaf = path.split('.').reduce<unknown>(
          (node, key) => (typeof node === 'object' && node !== null ? Reflect.get(node, key) : undefined),
          messages,
        )
        return typeof leaf !== 'string' || leaf.trim() === ''
      })
      expect(empty).toEqual([])
    }
  })
})
