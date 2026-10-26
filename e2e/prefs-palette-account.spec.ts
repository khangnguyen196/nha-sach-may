import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { bookBlockTargets, createE2eUser, deleteE2eUsers, replaceUserBlocks, type E2eUser } from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { collectErrors, openPalette, waitForSettled } from './helpers'

// Palette ⌘K che sách bị chặn theo sở thích (docs/plans/so-thich-canh-bao.md, câu 11, quyết định (12)): khóa chặn đi kèm
// kết quả /api/search (công khai, không đọc phiên), che ở client theo mục chặn mà RevealBlocked đưa vào block-store. Dòng
// bị che không có tên / bìa; Enter / bấm = Xem (palette vẫn mở), lần sau mới mở sách; đã Xem giữ tới khi tải lại trang.
// User riêng mỗi test, mục chặn chèn bằng service role (trừ (c): bấm nút ở trang sách), xóa user ở finally (user_blocks
// xóa theo cascade). Chỉ chặn tác giả của sách mẫu, không sửa sách. Giả định dữ liệu: scripts/e2e-seed.test.ts
// (prefs-palette-account).
test.use({ storageState: NO_SESSION })

/** Từ khóa: ≥ 2 sách mẫu ở danh mục đang hiện, ≤ 8 (mọi kết quả vào palette) */
const QUERY = 'van hoa'
/** Kết quả của QUERY có tác giả (vai trò author) không có ở kết quả nào khác của QUERY: chặn tác giả này che đúng cuốn này */
const BLOCKED = 'tuyen-tap-van-hoc-viet-cho-thieu-nhi-to-hoai-1-truyen-dong-thoai-kich'
/** Kết quả khác của QUERY, không cùng tác giả với BLOCKED */
const VISIBLE = 'tu-dien-van-hoa-co-truyen-viet-nam'
const HIDDEN_TEXT = 'Đã ẩn theo sở thích của bạn'

type Target = Awaited<ReturnType<typeof bookBlockTargets>>

const bookOption = (dialog: Locator, target: Target) => dialog.locator(`[cmdk-item][data-value="book-${target.id}"]`)
const bookOptions = (dialog: Locator) => dialog.locator('[cmdk-item][data-value^="book-"]')
const blockStyles = (page: Page) => page.locator('style[data-testid="block-styles"]')
const isTouch = (testInfo: TestInfo) => testInfo.project.use.isMobile === true

async function targets() {
  const [blocked, visible] = await Promise.all([bookBlockTargets(BLOCKED), bookBlockTargets(VISIBLE)])
  const [author] = blocked.authors
  if (!author) throw new Error(`${BLOCKED}: không có tác giả vai trò author`)
  if (visible.authorIds.includes(author.id)) throw new Error(`${VISIBLE}: cùng tác giả với ${BLOCKED}`)
  return { blocked, visible, author }
}

/** Mở palette, gõ QUERY, chờ có kết quả sách (đủ cả hai cuốn của spec) */
async function searchInPalette(page: Page, blocked: Target, visible: Target) {
  const dialog = await openPalette(page)
  await dialog.getByRole('combobox').fill(QUERY)
  await expect(bookOption(dialog, blocked)).toHaveCount(1)
  await expect(bookOption(dialog, visible)).toHaveCount(1)
  return dialog
}

async function expectVeiled(option: Locator, target: Target) {
  await expect(option).toContainText(HIDDEN_TEXT)
  await expect(option).toContainText('Xem')
  await expect(option).not.toContainText(target.title)
  await expect(option.locator('img')).toHaveCount(0)
  // Không lồng nút trong option (một mục chọn của listbox)
  await expect(option.getByRole('button')).toHaveCount(0)
}

async function expectShown(option: Locator, target: Target) {
  await expect(option).toContainText(target.title)
  await expect(option).not.toContainText(HIDDEN_TEXT)
  await expect(option.locator('img')).toHaveCount(1)
}

/** Listener / store đã có mục chặn (RevealBlocked gắn data-ready trong effect) và trang đã ổn định */
async function waitForBlocks(page: Page) {
  await expect(page.locator('style[data-testid="block-styles"][data-ready]').first()).toBeAttached()
  await waitForSettled(page)
}

async function withUser(label: string, run: (user: E2eUser) => Promise<void>) {
  const user = await createE2eUser(label)
  try {
    await run(user)
  } finally {
    await deleteE2eUsers([user.id])
  }
}

test('(a) đối chứng: thành viên không chặn gì → mọi dòng sách có tên + bìa, không dòng nào bị che', async ({ page }, testInfo) => {
  const errors = collectErrors(page)
  const { blocked, visible } = await targets()
  await withUser(`${testInfo.project.name}-prefs-palette-a`, async (user) => {
    await login(page, user)
    await page.goto('/')
    await waitForSettled(page)
    await expect(blockStyles(page)).toHaveCount(0)
    const dialog = await searchInPalette(page, blocked, visible)
    const count = await bookOptions(dialog).count()
    expect(count).toBeGreaterThanOrEqual(2)
    await expect(dialog.getByText(HIDDEN_TEXT)).toHaveCount(0)
    await expectShown(bookOption(dialog, blocked), blocked)
    await expectShown(bookOption(dialog, visible), visible)
    await expect(bookOptions(dialog).locator('img')).toHaveCount(count)
    expect(errors).toEqual([])
  })
})

test('(b)(d) chặn tác giả: dòng đó bị che (không tên / bìa), dòng khác vẫn hiện; Xem bằng Enter (desktop) / bấm (mobile) giữ palette mở, lần sau mở sách; Xem giữ qua đóng / mở, tải lại che lại', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page)
  const { blocked, visible, author } = await targets()
  const touch = isTouch(testInfo)
  await withUser(`${testInfo.project.name}-prefs-palette-b`, async (user) => {
    await replaceUserBlocks(user.id, [{ kind: 'author', author_id: author.id }])
    await login(page, user)
    await page.goto('/')
    await waitForBlocks(page)

    let dialog = await searchInPalette(page, blocked, visible)
    const veiled = bookOption(dialog, blocked)
    await expectVeiled(veiled, blocked)
    await expect(dialog.getByRole('option', { name: new RegExp(HIDDEN_TEXT) })).toHaveCount(1)
    await expectShown(bookOption(dialog, visible), visible)
    // Cùng chiều cao dòng thường (khối giữ chỗ thay bìa)
    const [veiledBox, shownBox] = await Promise.all([veiled.boundingBox(), bookOption(dialog, visible).boundingBox()])
    expect(Math.abs((veiledBox?.height ?? 0) - (shownBox?.height ?? -10))).toBeLessThanOrEqual(1)

    const url = page.url()
    if (touch) {
      // (d) mobile: bấm = Xem
      await veiled.click()
    } else {
      // Bàn phím: mũi tên xuống tới dòng bị che (dòng đầu là "Xem tất cả"), Enter = Xem
      const count = await dialog.getByRole('option').count()
      for (let step = 0; step < count && (await veiled.getAttribute('aria-selected')) !== 'true'; step++) {
        await page.keyboard.press('ArrowDown')
      }
      await expect(veiled).toHaveAttribute('aria-selected', 'true')
      await page.keyboard.press('Enter')
    }
    await expectShown(veiled, blocked)
    await expect(dialog).toBeVisible()
    expect(page.url()).toBe(url)
    if (!touch) await expect(veiled).toHaveAttribute('aria-selected', 'true')

    // Lần sau: mở sách
    if (touch) await veiled.click()
    else await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/sach/${BLOCKED}$`))
    await expect(dialog).toBeHidden()
    await waitForSettled(page)

    // Đã Xem giữ qua đóng / mở palette (không tải lại)
    dialog = await searchInPalette(page, blocked, visible)
    await expectShown(bookOption(dialog, blocked), blocked)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    dialog = await searchInPalette(page, blocked, visible)
    await expectShown(bookOption(dialog, blocked), blocked)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    // Tải lại: che lại
    await page.reload()
    await waitForBlocks(page)
    dialog = await searchInPalette(page, blocked, visible)
    await expectVeiled(bookOption(dialog, blocked), blocked)
    await expectShown(bookOption(dialog, visible), visible)
    expect(errors).toEqual([])
  })
})

test('(c) chặn / bỏ chặn bằng nút ở trang sách (không tải lại) → palette che / hiện theo ngay', async ({ page }, testInfo) => {
  const errors = collectErrors(page)
  const { blocked, visible, author } = await targets()
  await withUser(`${testInfo.project.name}-prefs-palette-c`, async (user) => {
    await login(page, user)
    await page.goto(`/sach/${BLOCKED}`)
    await waitForSettled(page)
    await page.evaluate(() => Reflect.set(window, '__paletteNoReload', true))
    const main = page.getByRole('main')

    // Chưa chặn: dòng hiện tên
    let dialog = await searchInPalette(page, blocked, visible)
    await expectShown(bookOption(dialog, blocked), blocked)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    const menu = main.getByTestId('book-prefs-menu')
    await menu.locator('summary').click()
    await menu.getByRole('button', { name: `Không muốn thấy tác giả «${author.name}»` }).click()
    await expect(main.getByTestId('book-prefs-blocked')).toContainText(`Bạn đã chặn tác giả «${author.name}»`)
    await expect(page.locator('style[data-testid="block-styles"][data-ready]').first()).toBeAttached()

    dialog = await searchInPalette(page, blocked, visible)
    await expectVeiled(bookOption(dialog, blocked), blocked)
    await expectShown(bookOption(dialog, visible), visible)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await main.getByRole('button', { name: `Bỏ chặn tác giả «${author.name}»` }).click()
    await expect(main.getByTestId('book-prefs-blocked')).toHaveCount(0)
    await expect(blockStyles(page)).toHaveCount(0)

    dialog = await searchInPalette(page, blocked, visible)
    await expectShown(bookOption(dialog, blocked), blocked)
    await expect(dialog.getByText(HIDDEN_TEXT)).toHaveCount(0)
    expect(await page.evaluate(() => Reflect.get(window, '__paletteNoReload') === true)).toBe(true)
    expect(errors).toEqual([])
  })
})
