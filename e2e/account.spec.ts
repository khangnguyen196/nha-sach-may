import { randomUUID } from 'node:crypto'
import { test as base, expect, type Locator, type Page } from '@playwright/test'
import {
  canRefresh,
  canSignIn,
  clearAddresses,
  createE2eUser,
  deleteE2eUsers,
  recoveryTokenHash,
  refreshTokenFromCookies,
} from '../scripts/e2e-user'
import { fillLogin, login, NO_SESSION, readCredentials, storageStatePath, type ProjectUsers } from './auth'
import { collectErrors, fillAddress, waitForHydration } from './helpers'

// Mặc định mọi test dùng phiên đã đăng nhập sẵn của project (auth.setup.ts); test cần trạng thái khách tự bỏ phiên.
const test = base.extend<{ users: ProjectUsers }>({
  users: async ({}, provide, testInfo) => {
    const users = readCredentials()[testInfo.project.name]
    if (!users) throw new Error(`Không có user e2e cho project ${testInfo.project.name}`)
    await provide(users)
  },
  storageState: async ({}, provide, testInfo) => provide(storageStatePath(testInfo.project.name)),
})

const accountLink = (page: Page, name: string) =>
  page.getByRole('banner').getByRole('link', { name: `Tài khoản của ${name}` })

test.describe('khách (chưa đăng nhập)', () => {
  test.use({ storageState: NO_SESSION })

  test('/tai-khoan → đăng nhập kèm next, đăng nhập xong quay lại đúng trang', async ({ page, users }) => {
    const errors = collectErrors(page)
    await page.goto('/tai-khoan/dia-chi')
    await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftai-khoan%2Fdia-chi$/)

    await fillLogin(page, users.user)
    await expect(page).toHaveURL(/\/tai-khoan\/dia-chi$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Sổ địa chỉ' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('/tai-khoan chưa đăng nhập → /dang-nhap?next=%2Ftai-khoan', async ({ page }) => {
    await page.goto('/tai-khoan')
    await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftai-khoan$/)
  })

  test('sai mật khẩu → lỗi tại chỗ, cùng thông báo với email không tồn tại', async ({ page, users }) => {
    const errors = collectErrors(page)
    await page.goto('/dang-nhap')
    const message = 'Email hoặc mật khẩu không đúng.'

    await fillLogin(page, { email: users.user.email, password: 'sai-mat-khau-123' })
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(message)
    await expect(page).toHaveURL(/\/dang-nhap$/)
    // Không mất email đã nhập (form không bị reset)
    await expect(page.getByRole('main').getByLabel('Email')).toHaveValue(users.user.email)

    await fillLogin(page, { email: 'khong-ton-tai-e2e@example.com', password: 'sai-mat-khau-123' })
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(message)
    expect(errors).toEqual([])
  })

  test('lỗi từng ô: email sai định dạng, thiếu mật khẩu', async ({ page }) => {
    await page.goto('/dang-nhap')
    await fillLogin(page, { email: 'khong-phai-email', password: '' })
    await expect(page.getByRole('main').getByText('Email không hợp lệ.')).toBeVisible()
    await expect(page.getByRole('main').getByText('Vui lòng điền thông tin này.')).toBeVisible()
    await expect(page.getByRole('main').getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  test('đăng nhập → header đổi trạng thái; đăng xuất → về như cũ, /tai-khoan lại bị chặn', async ({ page, users }) => {
    // Phiên riêng của test này: đăng xuất (scope local) không làm hỏng storageState dùng chung
    const errors = collectErrors(page)
    await page.goto('/')
    await expect(page.getByRole('banner').getByRole('link', { name: 'Đăng nhập' })).toBeVisible()

    await login(page, users.user)
    await page.goto('/')
    await expect(accountLink(page, users.user.fullName)).toBeVisible()

    await page.goto('/tai-khoan')
    await waitForHydration(page, 'main form button[type="submit"]')
    await page.getByRole('button', { name: 'Đăng xuất' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('banner').getByRole('link', { name: 'Đăng nhập' })).toBeVisible()

    await page.goto('/tai-khoan')
    await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftai-khoan$/)
    expect(errors).toEqual([])
  })

  test('đã đăng nhập vào /dang-nhap → chuyển tới next', async ({ page, users }) => {
    await login(page, users.user)
    await page.goto('/dang-nhap?next=%2Ftai-khoan%2Fdia-chi')
    await expect(page).toHaveURL(/\/tai-khoan\/dia-chi$/)
    // next trỏ ra ngoài → bỏ qua, về tài khoản
    await page.goto('/dang-ky?next=%2F%2Fevil.example')
    await expect(page).toHaveURL(/\/tai-khoan$/)
  })

  test('link xác nhận hỏng → trang trung gian → bấm xác nhận → trang đăng nhập báo link hết hạn', async ({ page }) => {
    await page.goto('/api/auth/confirm?token_hash=khong-hop-le&type=email')
    // GET không tiêu thụ token: chỉ chuyển sang trang có nút "Xác nhận" (POST)
    await expect(page).toHaveURL(/\/xac-nhan\?token_hash=khong-hop-le&type=email$/)
    await page.getByRole('button', { name: 'Xác nhận email' }).click()
    await expect(page).toHaveURL(/\/dang-nhap\?error=LINK_EXPIRED$/)
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Liên kết đã hết hạn')
  })

  // Template mặc định: link hết hạn / đã dùng → Supabase chuyển về redirectTo, lỗi nằm sau # (server không thấy)
  test('link đặt lại mật khẩu lỗi (lỗi sau #) → "Yêu cầu liên kết mới" → quên mật khẩu', async ({ page }) => {
    await page.goto('/api/auth/confirm?locale=vi&type=recovery&next=%2Fdat-lai-mat-khau#error=access_denied&error_code=otp_expired')
    await expect(page).toHaveURL(/\/xac-nhan\?/)
    await expect(page.getByRole('main').getByRole('heading', { name: 'Liên kết đã hết hạn' })).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Yêu cầu liên kết mới' }).click()
    await expect(page).toHaveURL(/\/quen-mat-khau$/)
  })

  test('/xac-nhan thiếu token, không có lỗi sau # → "Liên kết không hợp lệ" + về đăng nhập', async ({ page }) => {
    await page.goto('/xac-nhan?type=recovery')
    await expect(page.getByRole('main').getByRole('heading', { name: 'Liên kết không hợp lệ' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'Về trang đăng nhập' })).toBeVisible()
  })

  // Template email mặc định của Supabase: /auth/v1/verify chuyển về redirectTo của app kèm ?code= (PKCE). Mã thật chỉ
  // có khi Supabase gửi email (admin generateLink cho link implicit, token sau #), nên ở đây kiểm tra các nhánh lỗi;
  // nhánh đổi code thành công có Vitest (src/app/api/auth/confirm/route.test.ts).
  test('link ?code= mở ở trình duyệt không có code verifier: đặt lại mật khẩu → yêu cầu link mới', async ({ page }) => {
    await page.goto(`/api/auth/confirm?code=${randomUUID()}&type=recovery&locale=vi&next=%2Fdat-lai-mat-khau`)
    await expect(page).toHaveURL(/\/quen-mat-khau\?error=LINK_EXPIRED$/)
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Liên kết đã hết hạn')
  })

  test('link ?code= xác nhận đăng ký mở ở trình duyệt khác → đăng nhập kèm thông báo đã xác nhận', async ({ page }) => {
    await page.goto(`/api/auth/confirm?code=${randomUUID()}&type=signup&locale=en&next=%2Fen%2Faccount`)
    await expect(page).toHaveURL(/\/en\/login\?confirmed=1$/)
    await expect(page.getByRole('main').getByRole('status')).toContainText('Your email is confirmed')
  })

  test('Supabase báo link hết hạn (?error_code=otp_expired) → trang yêu cầu link mới đúng ngôn ngữ', async ({ page }) => {
    await page.goto('/api/auth/confirm?error=access_denied&error_code=otp_expired&type=recovery&locale=en')
    await expect(page).toHaveURL(/\/en\/forgot-password\?error=LINK_EXPIRED$/)
  })

  test('đặt lại mật khẩu thu hồi phiên khác, giữ phiên hiện tại', async ({ browser, baseURL }, testInfo) => {
    test.setTimeout(90_000)
    // User riêng cho mỗi lần chạy: test đổi mật khẩu, dùng lại user thì lần chạy sau (retry, --repeat-each) đăng nhập
    // bằng mật khẩu cũ và fail. Xóa ở finally; sót (lần chạy bị ngắt) thì setup lần sau dọn.
    const reset = await createE2eUser(`${testInfo.project.name}-reset`)
    const contextA = await browser.newContext({ baseURL, storageState: NO_SESSION })
    const contextB = await browser.newContext({ baseURL, storageState: NO_SESSION })
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    const errors = collectErrors(pageA)

    try {
      await login(pageA, reset)
      await login(pageB, reset)
      const tokenB = refreshTokenFromCookies(await contextB.cookies())

      // Link trong email đặt lại mật khẩu, lấy bằng admin API thay vì gửi thư
      const tokenHash = await recoveryTokenHash(reset.email)
      const link = `/api/auth/confirm?token_hash=${tokenHash}&type=recovery&next=%2Fdat-lai-mat-khau`
      // Trình quét link trong hộp thư mở link trước (GET, theo chuyển hướng): token vẫn còn dùng được
      expect((await pageA.request.get(link)).ok()).toBe(true)
      await pageA.goto(link)
      await expect(pageA).toHaveURL(/\/xac-nhan\?/)
      await pageA.getByRole('button', { name: 'Tiếp tục' }).click()
      await expect(pageA).toHaveURL(/\/dat-lai-mat-khau$/)

      const newPassword = `${reset.password}-moi`
      await waitForHydration(pageA, 'main form button[type="submit"]')
      await pageA.getByRole('main').getByLabel('Mật khẩu mới').fill(newPassword)
      await pageA.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
      await expect(pageA.getByRole('heading', { name: 'Đã đổi mật khẩu' })).toBeVisible()

      const tokenA = refreshTokenFromCookies(await contextA.cookies())
      expect(await canRefresh(tokenB)).toBe(false)
      expect(await canRefresh(tokenA)).toBe(true)
      expect(await canSignIn(reset.email, reset.password)).toBe(false)
      expect(await canSignIn(reset.email, newPassword)).toBe(true)
      expect(errors).toEqual([])
    } finally {
      await Promise.all([contextA.close(), contextB.close()])
      await deleteE2eUsers([reset.id])
    }
  })
})

test.describe('đã đăng nhập', () => {
  test('header hiện chữ cái đầu tên, link tới tài khoản', async ({ page, users }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    const link = accountLink(page, users.user.fullName)
    await expect(link).toHaveText(/E/)
    await link.click()
    await expect(page).toHaveURL(/\/tai-khoan$/)
    await expect(page.getByRole('main').getByText(users.user.email)).toBeVisible()
    // Link quản trị chỉ render khi server xác nhận admin. goto chờ load = mọi Suspense đã stream xong.
    await page.goto('/tai-khoan')
    await expect(page.getByRole('main').getByText(users.user.email)).toBeVisible()
    await expect(page.getByRole('link', { name: /Quản trị/ })).toHaveCount(0)
    await expect(page.getByTestId('header-admin-link')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('sổ địa chỉ: thêm, mặc định, lỗi số điện thoại, sửa, xóa', async ({ page, users }) => {
    test.setTimeout(90_000)
    const errors = collectErrors(page)
    await clearAddresses(users.user.id)

    await page.goto('/tai-khoan/dia-chi')
    await expect(page.getByRole('main').getByText('Chưa có địa chỉ nào')).toBeVisible()

    // Địa chỉ đầu tiên → tự thành mặc định
    await page.getByRole('main').getByRole('link', { name: 'Thêm địa chỉ' }).first().click()
    await expect(page).toHaveURL(/\/tai-khoan\/dia-chi\/moi$/)
    await fillAddress(page, {
      name: 'Người Nhận Một',
      phone: '0912 345 678',
      province: 'Thành phố Hà Nội',
      ward: 'Phường Ba Đình',
      street: '12 Phố Huế',
    })
    await page.getByRole('button', { name: 'Lưu địa chỉ' }).click()
    await expect(page).toHaveURL(/\/tai-khoan\/dia-chi$/)
    const first = card(page, 'Người Nhận Một')
    await expect(first.getByText('Mặc định', { exact: true })).toBeVisible()
    await expect(first).toContainText('12 Phố Huế, Phường Ba Đình, Thành phố Hà Nội')

    // Số điện thoại sai → lỗi tại ô, không mất dữ liệu đã nhập
    await page.goto('/tai-khoan/dia-chi/moi')
    await fillAddress(page, {
      name: 'Người Nhận Hai',
      phone: '0123',
      province: 'Thành phố Hồ Chí Minh',
      ward: 'Phường Sài Gòn',
      street: '1 Lê Lợi',
    })
    await page.getByRole('button', { name: 'Lưu địa chỉ' }).click()
    await expect(page.getByRole('main').getByText('Số điện thoại di động không hợp lệ')).toBeVisible()
    await expect(page.getByRole('main').getByLabel('Số điện thoại')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('main').getByLabel('Phường/Xã')).toHaveValue(/\d+/)
    await page.getByRole('main').getByLabel('Số điện thoại').fill('+84 38 123 4567')
    await page.getByRole('button', { name: 'Lưu địa chỉ' }).click()
    await expect(page).toHaveURL(/\/tai-khoan\/dia-chi$/)

    const second = card(page, 'Người Nhận Hai')
    await expect(second).toContainText('0381234567')
    await expect(second.getByText('Mặc định', { exact: true })).toHaveCount(0)

    // Đặt cái thứ hai làm mặc định → nhãn chuyển sang
    await waitForHydration(page, 'main li form button[type="submit"]')
    await second.getByRole('button', { name: 'Đặt làm mặc định' }).click()
    await expect(card(page, 'Người Nhận Hai').getByText('Mặc định', { exact: true })).toBeVisible()
    await expect(card(page, 'Người Nhận Một').getByText('Mặc định', { exact: true })).toHaveCount(0)

    // Sửa: form điền sẵn (tỉnh/phường chọn sẵn từ tên đã lưu)
    await card(page, 'Người Nhận Một').getByRole('link', { name: 'Sửa địa chỉ của Người Nhận Một' }).click()
    await expect(page.getByRole('main').getByLabel('Phường/Xã')).toHaveValue('00004')
    await page.getByRole('main').getByLabel('Số nhà, tên đường').fill('34 Phố Huế')
    await page.getByRole('button', { name: 'Lưu địa chỉ' }).click()
    await expect(page).toHaveURL(/\/tai-khoan\/dia-chi$/)
    await expect(card(page, 'Người Nhận Một')).toContainText('34 Phố Huế')

    // Xóa (có bước xác nhận) → biến mất
    const toDelete = card(page, 'Người Nhận Một')
    await toDelete.getByText('Xóa', { exact: true }).click()
    await toDelete.getByRole('button', { name: 'Xóa vĩnh viễn' }).click()
    await expect(card(page, 'Người Nhận Một')).toHaveCount(0)
    await expect(card(page, 'Người Nhận Hai')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('/en/account: cùng luồng bằng tiếng Anh', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/en/account')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible()
    await page.getByRole('link', { name: /Address book/ }).click()
    await expect(page).toHaveURL(/\/en\/account\/addresses$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Address book' })).toBeVisible()

    await page.goto('/en/account/addresses/new')
    await waitForHydration(page, 'main form select[name="province"]')
    await page.getByRole('main').getByLabel('Province / City').selectOption({ label: 'Hanoi City' })
    await expect(page.getByRole('main').getByLabel('Ward / Commune').locator('option', { hasText: 'Ba Dinh Ward' })).toHaveCount(1)
    expect(errors).toEqual([])
  })

  test('ngôn ngữ email lưu vào hồ sơ', async ({ page }) => {
    await page.goto('/tai-khoan')
    await waitForHydration(page, 'main form select[name="locale"]')
    await page.getByRole('main').getByLabel('Ngôn ngữ email').selectOption('en')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.getByRole('main').getByText('Đã lưu.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('main').getByLabel('Ngôn ngữ email')).toHaveValue('en')
  })
})

function card(page: Page, name: string): Locator {
  return page.getByRole('main').getByRole('listitem').filter({ hasText: name })
}
