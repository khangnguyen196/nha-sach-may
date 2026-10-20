import { expect, test } from '@playwright/test'
import { createE2eUser, deleteE2eUsers } from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { waitForHydration } from './helpers'

// docs/plans/sau-ux.md mục 4: đăng xuất ở /tai-khoan (Server Action đổi cookie rồi redirect('/')) → router bỏ cache và
// prefetch lại các link khu tài khoản đang hiện, lúc cookie đã bị xóa → proxy 307 sang /dang-nhap → Next 404 segment
// (e2e chập chờn "gộp giỏ khách khi đăng nhập, đăng xuất rồi đăng nhập lại vẫn còn"). Kiểm thẳng: sau khi bấm Đăng xuất
// không có request RSC (GET) nào tới khu tài khoản, dù kết quả 200 hay 404. User riêng: đăng xuất xóa phiên.

test.use({ storageState: NO_SESSION })

test('đăng xuất ở /tai-khoan: không còn request RSC nào tới khu tài khoản (prefetch link /account, thẻ đơn hàng / địa chỉ)', async ({
  page,
}, testInfo) => {
  const user = await createE2eUser(`${testInfo.project.name}-logout`)
  try {
    await login(page, user)
    await waitForHydration(page, 'main form button[type="submit"]')
    await page.waitForLoadState('networkidle')

    const rsc: string[] = []
    page.on('request', (request) => {
      if (request.method() !== 'GET') return
      const url = new URL(request.url())
      const isRsc = url.searchParams.has('_rsc') || request.headers()['rsc'] === '1'
      if (isRsc && /^\/(en\/account|tai-khoan)/.test(url.pathname)) rsc.push(`${url.pathname}${url.search.replace(/_rsc=[^&]+/, '_rsc=…')}`)
    })
    await page.getByRole('main').getByRole('button', { name: 'Đăng xuất' }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.waitForTimeout(1_500)
    expect(rsc).toEqual([])
  } finally {
    await deleteE2eUsers([user.id])
  }
})
