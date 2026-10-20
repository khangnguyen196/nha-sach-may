import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/plans/no-js.md ★8: nút gửi của form dùng useFormAction khóa tới khi hydrate nhờ `ready={ready}` (gửi trước đó là
// POST thường → trang trắng). Form mới quên truyền thì lỗi quay lại mà không ai thấy → kiểm tĩnh: file nào gọi
// `useFormAction(` thì mọi `<SubmitButton` trong file phải có `ready=`.
const SRC = join(import.meta.dirname, '..')

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => join(entry.parentPath, entry.name))
}

const formFiles = tsxFiles(SRC).filter((file) => readFileSync(file, 'utf8').includes('useFormAction('))

describe('form dùng useFormAction truyền `ready` cho SubmitButton', () => {
  it('có ít nhất một file (bộ lọc còn đúng)', () => {
    expect(formFiles.length).toBeGreaterThan(10)
  })

  for (const file of formFiles) {
    it(relative(SRC, file).replaceAll('\\', '/'), () => {
      const source = readFileSync(file, 'utf8')
      // Thẻ mở `<SubmitButton …>`: dừng ở `>` không thuộc `=>`
      const tags = source.match(/<SubmitButton\b[\s\S]*?(?<!=)>/g) ?? []
      expect(tags.length).toBeGreaterThan(0)
      for (const tag of tags) expect(tag).toMatch(/\bready=\{/)
    })
  }
})
