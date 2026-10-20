import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/plans/no-js.md ★8: nút gửi form Server Action khóa tới khi hydrate (gửi trước đó là POST thường → trang trắng).
// Form dùng useFormAction truyền `ready={ready}`; form `<form action>` thường dùng `lockUntilHydrated`. Quên thì lỗi quay
// lại mà không ai thấy → kiểm tĩnh mọi `<SubmitButton` và mọi `<form` gửi POST trong src. Ngoại lệ có chủ đích (theo thẻ,
// không theo file): nút đăng xuất trong `<SignOutForm` ở trang tài khoản (kết thúc bằng redirect(), gửi được trước hydrate).
const SRC = join(import.meta.dirname, '..')
const TAG = '<SubmitButton'
const SIGN_OUT_PAGE = 'app/[locale]/(shop)/account/page.tsx'

/**
 * Form POST không gửi bằng `<SubmitButton` (không khóa trước hydrate) có chủ đích: kết thúc bằng 303, trang đích tải như
 * thường nên gửi trước hydrate / khi tắt JS không ra trang trắng. `count`: số form như vậy trong file (thêm form mới vào
 * file ngoại lệ thì test đỏ, phải xét lại).
 */
const UNLOCKED_FORMS: Record<string, { count: number; reason: string }> = {
  'features/auth/components/sign-out-form.tsx': {
    count: 1,
    reason: 'đăng xuất: signOut kết thúc bằng redirect() (303); nút (SubmitButton) nằm ở trang tài khoản, ngoại lệ ở trên',
  },
  'features/cart/components/add-to-cart-button.tsx': {
    count: 1,
    reason: 'thêm giỏ không JS: addToCartFromForm luôn redirect() (303) về giỏ / đăng nhập',
  },
  'app/[locale]/(auth)/confirm/page.tsx': {
    count: 1,
    reason: '/xac-nhan: POST tới Route Handler /api/auth/confirm, luôn trả 303',
  },
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => join(entry.parentPath, entry.name))
}

const startsTag = (source: string, i: number, tag: string) =>
  source.startsWith(tag, i) && /[\s>/]/.test(source[i + tag.length] ?? '')

/** Vị trí các thẻ mở `tag` (VD `<SubmitButton`, không tính `<SubmitButtonX`) */
function tagStarts(source: string, tag = TAG) {
  const starts: number[] = []
  for (let start = source.indexOf(tag); start !== -1; start = source.indexOf(tag, start + 1)) {
    if (startsTag(source, start, tag)) starts.push(start)
  }
  return starts
}

/**
 * Thẻ mở `<Tag …>`: bỏ qua `>` nằm trong `{…}` (VD `disabled={remaining > 0}`, `() =>`). Ngoặc lệch (ngoặc trong chuỗi /
 * comment), chạm thẻ cùng tên kế tiếp hay hết file mà chưa đóng thẻ → throw, không bỏ qua im lặng. `>` trong chuỗi
 * thuộc tính (VD `className="[&>svg]:…"`) làm cắt thẻ sớm → test đỏ giả (ồn), không lọt im lặng.
 */
function openingTag(source: string, start: number, tag = TAG) {
  let depth = 0
  for (let i = start + tag.length; i < source.length; i++) {
    if (startsTag(source, i, tag)) throw new Error(`Chưa đóng thẻ ở vị trí ${start} đã gặp ${tag} kế tiếp`)
    const char = source[i]
    if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    else if (char === '>' && depth === 0) return source.slice(start, i + 1)
    if (depth < 0) throw new Error(`Ngoặc lệch trong thẻ ở vị trí ${start}`)
  }
  throw new Error(`Không đóng được thẻ ở vị trí ${start}`)
}

/** `lockUntilHydrated` trần hoặc `={true}` (không nhận `={false}` / biểu thức) */
const hasLockUntilHydrated = (tag: string) => /(?<![\w-])lockUntilHydrated(?:\s*=\s*\{\s*true\s*\})?(?=[\s/>])/.test(tag)

/** `ready={…}` (không phải `ready={true}` / `ready={false}`, không phải `data-ready=`) hoặc `lockUntilHydrated` */
const isLocked = (tag: string) => /(?<![\w-])ready=\{\s*(?!(?:true|false)\s*\})/.test(tag) || hasLockUntilHydrated(tag)

/** Biểu thức trong `ready={…}` của thẻ (không có → undefined) */
const readyExpression = (tag: string) => /(?<![\w-])ready=\{\s*([^{}]*?)\s*\}/.exec(tag)?.[1]

/**
 * Biểu thức `ready` lấy từ từng lần gọi useFormAction trong file: `const { …, ready, … } = useFormAction(` → `ready`
 * (`ready: x` → `x`); `const form = useFormAction(` → `form.ready`. Lần gọi dạng khác → throw (sửa test cho dạng mới).
 */
function hookReadyExpressions(source: string) {
  const calls = source.split('useFormAction(').length - 1
  const expressions: string[] = []
  for (const match of source.matchAll(/const\s*\{([^{}]*)\}\s*=\s*useFormAction\(/g)) {
    const binding = (match[1] ?? '').split(',').map((part) => part.trim()).find((part) => /^ready\b/.test(part))
    // Không lấy `ready` từ hook → không có biểu thức hợp lệ, mọi SubmitButton của hook này sẽ đỏ
    expressions.push(binding ? (binding.split(':')[1]?.trim() ?? 'ready') : '')
  }
  for (const match of source.matchAll(/const\s+(\w+)\s*=\s*useFormAction\(/g)) expressions.push(`${match[1]}.ready`)
  if (expressions.length !== calls) throw new Error(`Có ${calls} lần gọi useFormAction( nhưng chỉ đọc được ${expressions.length}`)
  return expressions
}

/** Form gửi Server Action / POST: có `action=` hoặc trải `{...formProps}` của hook, không phải `method="get"` */
const isPostForm = (tag: string) =>
  (/(?<![\w-])action=/.test(tag) || /\{\s*\.\.\.\s*[\w.]*formProps\s*\}/.test(tag)) && !/(?<![\w-])method=["']get["']/i.test(tag)

const allFiles = tsxFiles(SRC).map((file) => ({
  path: relative(SRC, file).replaceAll('\\', '/'),
  source: readFileSync(file, 'utf8'),
}))
const files = allFiles.filter(({ path, source }) => source.includes(TAG) && !path.startsWith('components/ui/'))
const hookFiles = allFiles.filter(({ source }) => source.includes('useFormAction('))

/** Mọi form POST trong file: thẻ mở + phần thân tới `</form>` (form không lồng nhau) */
function postForms(source: string) {
  return tagStarts(source, '<form')
    .map((start) => {
      const tag = openingTag(source, start, '<form')
      const end = source.indexOf('</form>', start + tag.length)
      if (end === -1) throw new Error(`Không thấy </form> cho form ở vị trí ${start}`)
      return { tag, body: source.slice(start + tag.length, end) }
    })
    .filter(({ tag }) => isPostForm(tag))
}

const formFiles = allFiles
  .filter(({ path }) => !path.startsWith('components/ui/'))
  .map((file) => ({ ...file, forms: postForms(file.source) }))
  .filter(({ forms }) => forms.length > 0)

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
      // Ngoại lệ đúng một thẻ: nút đăng xuất nằm giữa <SignOutForm …> và </SignOutForm>
      let exempt: number | undefined
      if (path === SIGN_OUT_PAGE) {
        const open = source.indexOf('<SignOutForm')
        const close = open === -1 ? -1 : source.indexOf('</SignOutForm>', open)
        exempt = starts.find((start) => start > open && start < close)
        expect(exempt, 'không thấy nút đăng xuất trong <SignOutForm>…</SignOutForm>').toBeDefined()
      }
      for (const start of starts) {
        if (start === exempt) continue
        const tag = openingTag(source, start)
        expect(isLocked(tag), `thiếu ready / lockUntilHydrated: ${tag}`).toBe(true)
        // File không gọi hook: `ready` không có nguồn đúng (VD `ready={!pending}`) → phải dùng lockUntilHydrated. Nếu sau này có
        // component con nhận `ready` qua prop từ file cha gọi hook thì sửa test cho ca đó, đừng đổi nút sang lockUntilHydrated
        if (!source.includes('useFormAction(')) {
          expect(hasLockUntilHydrated(tag), `file không gọi useFormAction phải dùng lockUntilHydrated: ${tag}`).toBe(true)
        }
      }
    })
  }
})

describe('file gọi useFormAction: mọi SubmitButton truyền ready lấy từ hook', () => {
  it('bộ lọc còn đúng: có file gọi hook hai lần (form đánh giá)', () => {
    expect(hookFiles.length).toBeGreaterThan(10)
    expect(hookFiles.some(({ source }) => hookReadyExpressions(source).length > 1)).toBe(true)
  })

  for (const { path, source } of hookFiles) {
    it(path, () => {
      const expressions = hookReadyExpressions(source)
      const tags = tagStarts(source).map((start) => openingTag(source, start))
      for (const tag of tags) {
        expect(tag, `dùng lockUntilHydrated thay cho ready của hook: ${tag}`).not.toMatch(/(?<![\w-])lockUntilHydrated\b/)
        expect(expressions, `ready không lấy từ useFormAction: ${tag}`).toContain(readyExpression(tag))
      }
      // Mỗi lần gọi hook có ít nhất một nút dùng `ready` của nó (không có nút gửi plain Button thay thế)
      for (const expression of expressions) {
        expect(
          tags.some((tag) => readyExpression(tag) === expression),
          `không SubmitButton nào truyền ready={${expression || 'ready (hook không trả ready)'}}`,
        ).toBe(true)
      }
    })
  }
})

describe('form POST gửi bằng SubmitButton (form của hook: đúng ready của hook đó), không có nút submit thường', () => {
  it('bộ lọc còn đúng: thấy form của hook, form sổ địa chỉ và đủ các file ngoại lệ', () => {
    expect(formFiles.length).toBeGreaterThan(15)
    expect(formFiles.some(({ path }) => path === 'features/account/components/address-card.tsx')).toBe(true)
    for (const path of Object.keys(UNLOCKED_FORMS)) expect(formFiles.map((file) => file.path)).toContain(path)
  })

  for (const { path, forms } of formFiles) {
    it(path, () => {
      const exception = UNLOCKED_FORMS[path]
      if (exception) {
        expect(forms.length, `số form ngoại lệ (${exception.reason})`).toBe(exception.count)
        return
      }
      for (const { tag, body } of forms) {
        const buttons = tagStarts(body).map((start) => openingTag(body, start))
        expect(buttons.length, `form POST không có SubmitButton: ${tag}`).toBeGreaterThan(0)
        // Nút submit thường (không khóa) trong cùng form
        expect(body, `form POST có nút type="submit" không phải SubmitButton: ${tag}`).not.toMatch(/type=(?:\{\s*)?["']submit["']/)
        // Form của hook (`{...x.formProps}` / `action={x.formProps.action}`): nút trong form dùng `ready` của đúng hook đó.
        // Giả định không đổi tên khi destructure (`{ ready: isReady }`, `{ formProps: fp }` → đỏ giả, sửa test khi gặp)
        const hook = /(?:\.\.\.\s*|action=\{\s*)((?:\w+\.)?)formProps\b/.exec(tag)
        if (hook) {
          const expected = `${hook[1] ?? ''}ready`
          expect(
            buttons.some((button) => readyExpression(button) === expected),
            `SubmitButton trong form không dùng ready={${expected}}: ${tag}`,
          ).toBe(true)
        }
      }
    })
  }
})
