import { expect, test } from '@playwright/test'
import { createE2eUser, deleteE2eUsers } from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { collectErrors } from './helpers'

// docs/plans/sau-ux.md mục 4 (giả thuyết): đăng xuất ở /tai-khoan (Server Action đổi cookie rồi redirect('/')) → router
// bỏ cache và prefetch lại các link khu tài khoản đang hiện, lúc cookie đã bị xóa → proxy 307 sang /dang-nhap → Next
// 404 segment (e2e chập chờn "gộp giỏ khách khi đăng nhập, đăng xuất rồi đăng nhập lại vẫn còn", chỉ khi chạy cả bộ).
// Kiểm thẳng: sau khi bấm Đăng xuất không có request RSC (GET) nào tới khu tài khoản, dù kết quả 200 hay 404.
// CPU chậm x6 (giả máy CI bận). Lưu ý: chạy riêng, test này qua cả khi bỏ bản sửa (sau-ux.md mục 4), tức chỉ bắt được
// khi prefetch sau đăng xuất xảy ra lần nào cũng có; kiểm tĩnh `prefetch={false}` ở src/lib/no-prefetch-account.test.ts.
// User riêng: đăng xuất xóa phiên.

test.use({ storageState: NO_SESSION })

test('đăng xuất ở /tai-khoan (qua router, không tải lại trang): không còn request RSC nào tới khu tài khoản', async ({
  page,
}, testInfo) => {
  const user = await createE2eUser(`${testInfo.project.name}-logout`)
  const errors = collectErrors(page)
  try {
    await login(page, user)
    // Chờ chính form đăng xuất hydrate (nút "Đăng nhập" của trang trước có thể còn ẩn trong <main> nhờ Activity)
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('main form button')].find((b) => b.textContent?.includes('Đăng xuất'))
      const form = button?.closest('form')
      return form !== null && form !== undefined && Object.keys(form).some((key) => key.startsWith('__reactProps'))
    })
    await page.waitForLoadState('networkidle')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })

    const rsc: string[] = []
    let documents = 0
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documents += 1
      if (request.method() !== 'GET') return
      const url = new URL(request.url())
      const isRsc = url.searchParams.has('_rsc') || request.headers()['rsc'] === '1'
      if (isRsc && /^\/(en\/account|tai-khoan)(\/|$)/.test(url.pathname)) {
        rsc.push(`${url.pathname}${url.search.replace(/_rsc=[^&]+/, '_rsc=…')}`)
      }
    })
    await page.getByRole('main').getByRole('button', { name: 'Đăng xuất' }).click()
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
    await page.waitForTimeout(1_500)
    // Đi qua router (Server Action + redirect phía client): không có lần tải tài liệu nào, nếu không test vô nghĩa
    expect(documents).toBe(0)
    expect(rsc).toEqual([])
    expect(errors).toEqual([])
  } finally {
    await deleteE2eUsers([user.id])
  }
})
