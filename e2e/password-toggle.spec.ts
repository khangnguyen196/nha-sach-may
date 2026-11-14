import { expect, test, type Locator, type Page, type Route } from '@playwright/test'
import { collectErrors, waitForHydration } from './helpers'

// Nút hiện / ẩn mật khẩu (PasswordField): leaf client, chỉ có sau hydrate, type="button" (không gửi form), về
// type="password" khi gửi. Khách chưa đăng nhập, không tạo tài khoản (đăng ký bị chặn ở bước kiểm tra dữ liệu). Trang đặt
// lại mật khẩu (cần phiên recovery): password-toggle-account.spec.ts. Chữ gõ thử là chuỗi giả.

type AuthPage = {
  path: string
  password: string
  show: string
  hide: string
  submit: string
  /** Mật khẩu giả gõ vào ô ở test gửi (đăng ký: quá ngắn → bị chặn ở bước kiểm tra, không tạo tài khoản) */
  typed: string
  /** Điền mọi ô trừ mật khẩu sao cho gửi xong có lỗi, không tạo phiên / tài khoản */
  fill: (main: Locator) => Promise<void>
  /** Lỗi hiện sau khi gửi ở `fill` + mật khẩu giả */
  error: (main: Locator) => Locator
  /** Lỗi khi gửi form trống (bàn phím: Enter trong ô mật khẩu) */
  emptyError: string
}

const FAKE_PASSWORD = 'mat-khau-gia-123'
const SHORT_PASSWORD = 'ngan1'

const PAGES: AuthPage[] = [
  {
    path: '/dang-nhap',
    password: 'Mật khẩu',
    show: 'Hiện mật khẩu',
    hide: 'Ẩn mật khẩu',
    submit: 'Đăng nhập',
    typed: FAKE_PASSWORD,
    fill: (main) => main.getByLabel('Email', { exact: true }).fill('khong-ton-tai-e2e@example.com'),
    error: (main) => main.getByRole('alert').filter({ hasText: 'Email hoặc mật khẩu không đúng.' }),
    emptyError: 'Vui lòng điền thông tin này.',
  },
  {
    path: '/dang-ky',
    password: 'Mật khẩu',
    show: 'Hiện mật khẩu',
    hide: 'Ẩn mật khẩu',
    submit: 'Đăng ký',
    typed: SHORT_PASSWORD,
    fill: async (main) => {
      await main.getByLabel('Họ và tên', { exact: true }).fill('Kiểm Thử Nút Mắt')
      await main.getByLabel('Email', { exact: true }).fill('khong-tao-e2e@example.com')
    },
    error: (main) => main.getByText('Mật khẩu cần ít nhất 8 ký tự.', { exact: true }),
    emptyError: 'Vui lòng điền thông tin này.',
  },
  {
    path: '/en/login',
    password: 'Password',
    show: 'Show password',
    hide: 'Hide password',
    submit: 'Sign in',
    typed: FAKE_PASSWORD,
    fill: (main) => main.getByLabel('Email', { exact: true }).fill('khong-ton-tai-e2e@example.com'),
    error: (main) => main.getByRole('alert').filter({ hasText: 'Incorrect email or password.' }),
    emptyError: 'Please fill in this field.',
  },
  {
    path: '/en/register',
    password: 'Password',
    show: 'Show password',
    hide: 'Hide password',
    submit: 'Create account',
    typed: SHORT_PASSWORD,
    fill: async (main) => {
      await main.getByLabel('Full name', { exact: true }).fill('Kiểm Thử Nút Mắt')
      await main.getByLabel('Email', { exact: true }).fill('khong-tao-e2e@example.com')
    },
    error: (main) => main.getByText('Password must be at least 8 characters.', { exact: true }),
    emptyError: 'Please fill in this field.',
  },
]

/** Đếm request Server Action (POST có header next-action) */
function countActions(page: Page) {
  let count = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.headers()['next-action']) count += 1
  })
  return () => count
}

async function open(page: Page, { path, password, show }: AuthPage) {
  await page.goto(path)
  await waitForHydration(page, 'main form button[type="submit"]')
  const main = page.getByRole('main')
  const input = main.getByLabel(password, { exact: true })
  const toggle = main.getByRole('button', { name: show, exact: true })
  await expect(toggle).toBeVisible()
  // Cùng nút, không theo nhãn (nhãn đổi theo trạng thái)
  const button = main.locator(`button[aria-controls="${await input.getAttribute('id')}"]`)
  return { main, input, toggle, button }
}

for (const config of PAGES) {
  test.describe(config.path, () => {
    test('bấm nút: đổi type + aria, không gửi form', async ({ page }) => {
      const errors = collectErrors(page)
      const actions = countActions(page)
      const { main, input, toggle, button } = await open(page, config)
      const url = page.url()

      await expect(input).toHaveAttribute('type', 'password')
      await expect(toggle).toHaveAttribute('type', 'button')
      await expect(toggle).not.toHaveAttribute('aria-pressed')
      await expect(toggle).toHaveAccessibleName(config.show)
      await expect(toggle).toHaveAttribute('aria-controls', (await input.getAttribute('id')) ?? '')
      await input.fill(FAKE_PASSWORD)

      await button.click()
      await expect(input).toHaveAttribute('type', 'text')
      await expect(button).toHaveAccessibleName(config.hide)
      await expect(button).not.toHaveAttribute('aria-pressed')
      await expect(input).toHaveValue(FAKE_PASSWORD)

      await button.click()
      await expect(input).toHaveAttribute('type', 'password')
      await expect(button).toHaveAccessibleName(config.show)
      await expect(input).toHaveValue(FAKE_PASSWORD)

      expect(page.url()).toBe(url)
      await expect(main.getByRole('alert')).toHaveCount(0)
      await expect(main.locator('[id$="-error"]')).toHaveCount(0)
      expect(actions()).toBe(0)
      expect(errors).toEqual([])
    })

    test('bàn phím: Tab tới nút, Space / Enter đổi trạng thái không gửi; Enter trong ô thì gửi', async ({ page }) => {
      const actions = countActions(page)
      const { main, input, button } = await open(page, config)

      await input.focus()
      await page.keyboard.press('Tab')
      await expect(button).toBeFocused()
      await page.keyboard.press('Space')
      await expect(input).toHaveAttribute('type', 'text')
      await expect(button).toHaveAccessibleName(config.hide)
      await expect(button).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(input).toHaveAttribute('type', 'password')
      await expect(button).toHaveAccessibleName(config.show)
      await expect(button).toBeFocused()

      // Form trống: gửi chỉ ra lỗi kiểm tra dữ liệu ở server (không gọi Supabase Auth)
      await input.focus()
      await page.keyboard.press('Enter')
      await expect(main.getByText(config.emptyError, { exact: true }).first()).toBeVisible()
      // Đúng một lần gửi: Space / Enter trên nút không gửi form
      expect(actions()).toBe(1)
    })

    test('gửi khi đang hiện → ô về type password', async ({ page }) => {
      const errors = collectErrors(page)
      const { main, input, toggle } = await open(page, config)
      await config.fill(main)
      await input.fill(config.typed)
      await toggle.click()
      await expect(input).toHaveAttribute('type', 'text')

      await main.getByRole('button', { name: config.submit, exact: true }).click()
      await expect(input).toHaveAttribute('type', 'password')
      await expect(config.error(main)).toBeVisible()
      await expect(input).toHaveAttribute('type', 'password')
      await expect(toggle).toHaveAccessibleName(config.show)
      expect(errors).toEqual([])
    })

    for (const { start, end } of [
      { start: 4, end: 4 },
      { start: 2, end: 6 },
    ]) {
      test(`bấm nút: ô giữ focus, giá trị và con trỏ / vùng chọn ${start}..${end}`, async ({ page }, testInfo) => {
        const errors = collectErrors(page)
        const actions = countActions(page)
        const { main, input, button } = await open(page, config)
        const url = page.url()
        await input.fill(FAKE_PASSWORD)
        await input.focus()
        await input.evaluate(
          (element: HTMLInputElement, range: { start: number; end: number }) => element.setSelectionRange(range.start, range.end),
          { start, end },
        )

        const expectKept = async (type: 'text' | 'password', name: string) => {
          await expect(input).toHaveAttribute('type', type)
          await expect(button).toHaveAccessibleName(name)
          await expect(input).toBeFocused()
          await expect(input).toHaveValue(FAKE_PASSWORD)
          const selection = await input.evaluate((element: HTMLInputElement) => [element.selectionStart, element.selectionEnd])
          expect(selection).toEqual([start, end])
        }

        // Chuột (click); chạm thật (tap) thêm ở project có hasTouch (mobile)
        await button.click()
        await expectKept('text', config.hide)
        await button.click()
        await expectKept('password', config.show)
        if (testInfo.project.use.hasTouch) {
          await button.tap()
          await expectKept('text', config.hide)
          await button.tap()
          await expectKept('password', config.show)
        }

        expect(page.url()).toBe(url)
        await expect(main.getByRole('alert')).toHaveCount(0)
        expect(actions()).toBe(0)
        expect(errors).toEqual([])
      })
    }

    test('bấm nút khi ô khác đang focus: không kéo focus vào ô mật khẩu', async ({ page }, testInfo) => {
      const errors = collectErrors(page)
      const actions = countActions(page)
      const { main, input, button } = await open(page, config)
      const email = main.getByLabel('Email', { exact: true })
      const url = page.url()
      await input.fill(FAKE_PASSWORD)
      await email.focus()

      const expectFocusOnEmail = async (type: 'text' | 'password', name: string) => {
        await expect(input).toHaveAttribute('type', type)
        await expect(button).toHaveAccessibleName(name)
        await expect(email).toBeFocused()
        await expect(input).not.toBeFocused()
        await expect(input).toHaveValue(FAKE_PASSWORD)
      }

      // Chuột (click); chạm thật (tap) thêm ở project có hasTouch (mobile)
      await button.click()
      await expectFocusOnEmail('text', config.hide)
      await button.click()
      await expectFocusOnEmail('password', config.show)
      if (testInfo.project.use.hasTouch) {
        await button.tap()
        await expectFocusOnEmail('text', config.hide)
        await button.tap()
        await expectFocusOnEmail('password', config.show)
      }

      expect(page.url()).toBe(url)
      await expect(main.getByRole('alert')).toHaveCount(0)
      expect(actions()).toBe(0)
      expect(errors).toEqual([])
    })

    for (const width of [320, 390]) {
      test(`màn ${width}px: không tràn ngang, nút nằm trọn trong ô, vùng bấm ≥ 44×44`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        const { input, toggle } = await open(page, config)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow).toBeLessThanOrEqual(0)

        const field = await input.boundingBox()
        const button = await toggle.boundingBox()
        if (!field || !button) throw new Error('Không đo được ô / nút mật khẩu')
        expect(button.width).toBeGreaterThanOrEqual(44)
        expect(button.height).toBeGreaterThanOrEqual(44)
        expect(button.x).toBeGreaterThanOrEqual(field.x)
        expect(button.y).toBeGreaterThanOrEqual(field.y)
        expect(button.x + button.width).toBeLessThanOrEqual(field.x + field.width + 0.5)
        expect(button.y + button.height).toBeLessThanOrEqual(field.y + field.height + 0.5)
      })
    }
  })
}

// Gõ mật khẩu trước khi hydrate (4G chậm): nút xuất hiện sau đó không xóa chữ, không lấy focus khỏi ô
// Không dùng blockHydration (helpers.ts): helper đó abort chunk JS nên trang không bao giờ hydrate; test này giữ chunk rồi thả
test('/dang-nhap: gõ mật khẩu trước hydrate → nút hiện sau, chữ và focus giữ nguyên', async ({ page }) => {
  const held: Route[] = []
  let released = false
  await page.route(/\/_next\/static\/chunks\/.*\.js(\?|$)/, (route) => {
    if (released) return route.continue()
    held.push(route)
  })
  await page.goto('/dang-nhap', { waitUntil: 'commit' })
  const main = page.getByRole('main')
  const input = main.getByLabel('Mật khẩu', { exact: true })
  await input.fill(FAKE_PASSWORD)
  await expect(main.getByRole('button', { name: 'Hiện mật khẩu', exact: true })).toHaveCount(0)

  released = true
  await Promise.all(held.splice(0).map((route) => route.continue()))
  await expect(main.getByRole('button', { name: 'Hiện mật khẩu', exact: true })).toBeVisible()
  await expect(input).toHaveValue(FAKE_PASSWORD)
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('type', 'password')
})
