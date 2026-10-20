import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/plans/no-js.md ★8: nút gửi form Server Action khóa tới khi hydrate (gửi trước đó là POST thường → trang trắng).
// Form dùng useFormAction truyền `ready={ready}`; form `<form action>` thường dùng `lockUntilHydrated`. Quên thì lỗi quay
// lại mà không ai thấy → kiểm tĩnh mọi `<SubmitButton` trong src. Ngoại lệ có chủ đích (theo thẻ, không theo file): nút
// đăng xuất trong `<SignOutForm` ở trang tài khoản (kết thúc bằng redirect(), gửi được trước hydrate).
const SRC = join(import.meta.dirname, '..')
const TAG = '<SubmitButton'
const SIGN_OUT_PAGE = 'app/[locale]/(shop)/account/page.tsx'

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => join(entry.parentPath, entry.name))
}

/** Vị trí các `<SubmitButton` (không tính `<SubmitButtonX`) */
function tagStarts(source: string) {
  const starts: number[] = []
  for (let start = source.indexOf(TAG); start !== -1; start = source.indexOf(TAG, start + 1)) {
    if (/[\s>/]/.test(source[start + TAG.length] ?? '')) starts.push(start)
  }
  return starts
}

/**
 * Thẻ mở `<SubmitButton …>`: bỏ qua `>` nằm trong `{…}` (VD `disabled={remaining > 0}`, `() =>`). Ngoặc lệch (ngoặc
 * trong chuỗi / comment), chạm `<SubmitButton` kế tiếp hay hết file mà chưa đóng thẻ → throw, không bỏ qua im lặng.
 */
function openingTag(source: string, start: number) {
  let depth = 0
  for (let i = start + TAG.length; i < source.length; i++) {
    if (source.startsWith(TAG, i)) throw new Error(`Chưa đóng thẻ ở vị trí ${start} đã gặp ${TAG} kế tiếp`)
    const char = source[i]
    if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    else if (char === '>' && depth === 0) return source.slice(start, i + 1)
    if (depth < 0) throw new Error(`Ngoặc lệch trong thẻ ở vị trí ${start}`)
  }
  throw new Error(`Không đóng được thẻ ở vị trí ${start}`)
}

/** `ready={…}` (không phải `ready={true}` / `ready={false}`, không phải `data-ready=`) hoặc `lockUntilHydrated` */
const isLocked = (tag: string) =>
  /(?<![\w-])ready=\{(?!(?:true|false)\})/.test(tag) || /(?<![\w-])lockUntilHydrated\b/.test(tag)

const files = tsxFiles(SRC)
  .map((file) => ({ path: relative(SRC, file).replaceAll('\\', '/'), source: readFileSync(file, 'utf8') }))
  .filter(({ path, source }) => source.includes(TAG) && !path.startsWith('components/ui/'))

describe('SubmitButton khóa tới khi hydrate (ready / lockUntilHydrated)', () => {
  it('bộ lọc còn đúng: có các file dùng useFormAction và cả 2 nguồn cờ', () => {
    expect(files.filter(({ source }) => source.includes('useFormAction(')).length).toBeGreaterThan(10)
    expect(files.some(({ source }) => source.includes('lockUntilHydrated'))).toBe(true)
    expect(files.some(({ path }) => path === SIGN_OUT_PAGE)).toBe(true)
  })

  for (const { path, source } of files) {
    it(path, () => {
      const starts = tagStarts(source)
      expect(starts.length).toBeGreaterThan(0)
      // Ngoại lệ đúng một thẻ: nút đăng xuất ngay trong <SignOutForm
      const signOut = path === SIGN_OUT_PAGE ? source.indexOf('<SignOutForm') : -1
      const exempt = signOut === -1 ? undefined : starts.find((start) => start > signOut)
      if (path === SIGN_OUT_PAGE) expect(exempt, 'không thấy nút đăng xuất trong <SignOutForm').toBeDefined()
      for (const start of starts) {
        if (start === exempt) continue
        const tag = openingTag(source, start)
        expect(isLocked(tag), `thiếu ready / lockUntilHydrated: ${tag}`).toBe(true)
      }
    })
  }
})
