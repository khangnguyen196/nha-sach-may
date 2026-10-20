import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/plans/no-js.md ★8: nút gửi form Server Action khóa tới khi hydrate (gửi trước đó là POST thường → trang trắng).
// Form dùng useFormAction truyền `ready={ready}`; form `<form action>` thường dùng `lockUntilHydrated`. Quên thì lỗi quay
// lại mà không ai thấy → kiểm tĩnh mọi `<SubmitButton` trong src. Ngoại lệ có chủ đích: nút đăng xuất (kết thúc bằng
// redirect(), gửi được trước hydrate).
const SRC = join(import.meta.dirname, '..')
const ALLOWED = new Set(['app/[locale]/(shop)/account/page.tsx'])

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => join(entry.parentPath, entry.name))
}

/** Thẻ mở `<SubmitButton …>`: bỏ qua `>` nằm trong `{…}` (VD `disabled={remaining > 0}`, `() =>`) */
function openingTags(source: string) {
  const tags: string[] = []
  for (let start = source.indexOf('<SubmitButton'); start !== -1; start = source.indexOf('<SubmitButton', start + 1)) {
    if (!/[\s>/]/.test(source[start + '<SubmitButton'.length] ?? '')) continue
    let depth = 0
    for (let i = start; i < source.length; i++) {
      const char = source[i]
      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      else if (char === '>' && depth === 0) {
        tags.push(source.slice(start, i + 1))
        break
      }
    }
  }
  return tags
}

const files = tsxFiles(SRC)
  .map((file) => ({ path: relative(SRC, file).replaceAll('\\', '/'), source: readFileSync(file, 'utf8') }))
  .filter(({ path, source }) => source.includes('<SubmitButton') && !path.startsWith('components/ui/'))

describe('SubmitButton khóa tới khi hydrate (ready / lockUntilHydrated)', () => {
  it('bộ lọc còn đúng: có các file dùng useFormAction và cả 2 nguồn cờ', () => {
    expect(files.filter(({ source }) => source.includes('useFormAction(')).length).toBeGreaterThan(10)
    expect(files.some(({ source }) => source.includes('lockUntilHydrated'))).toBe(true)
  })

  for (const { path, source } of files) {
    if (ALLOWED.has(path)) continue
    it(path, () => {
      const tags = openingTags(source)
      expect(tags.length).toBeGreaterThan(0)
      for (const tag of tags) {
        const locked = /\bready=\{(?!true\})/.test(tag) || /\blockUntilHydrated\b/.test(tag)
        expect(locked, `thiếu ready / lockUntilHydrated: ${tag}`).toBe(true)
      }
    })
  }
})
