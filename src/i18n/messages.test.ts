import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import vi from '../../messages/vi.json'
import { GLOBAL_ERROR_MESSAGES } from './global-error-messages'

function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key))
}

describe('messages', () => {
  it('vi.json và en.json có cùng bộ key', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(vi).sort())
  })

  it('chuỗi của global-error khớp namespace errorPage', () => {
    expect(GLOBAL_ERROR_MESSAGES).toEqual({ vi: vi.errorPage, en: en.errorPage })
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
