import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/plans/sau-ux.md mục 4: link vào khu tài khoản đang hiện ở trang có nút "Đăng xuất" không được prefetch (prefetch
// chạy sau khi cookie bị xóa → proxy 307 → Next 404 segment, e2e chập chờn). e2e không tái hiện được khi chạy riêng nên
// kiểm tĩnh mã nguồn: bỏ `prefetch={false}` thì test này fail.
const src = join(import.meta.dirname, '..')
const read = (path: string) => readFileSync(join(src, path), 'utf8')

describe('link khu tài khoản không prefetch', () => {
  it('icon /account ở header: cả fallback lẫn khi đã đăng nhập', () => {
    const source = read('components/layout/account-link.tsx')
    expect(source).toContain('<Link href="/account" prefetch={false}')
    expect(source).toContain('<IconLink href="/account" label={t(\'account\')} prefetch={false} />')
  })

  it('thẻ "Đơn hàng" / "Sổ địa chỉ" ở trang tài khoản', () => {
    const source = read('app/[locale]/(shop)/account/page.tsx')
    expect(source).toMatch(/function AccountCard\([^)]*\) \{\n\s+return \(\n\s+<Link href=\{href\} prefetch=\{false\}/)
  })
})
