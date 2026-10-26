import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import {
  bookBlockTargets,
  categoryBySlug,
  cleanupE2eAdminData,
  createE2eAuthors,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  replaceUserBlocks,
  setE2eBookWarnings,
  userBlocksOf,
  type E2eUser,
} from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { collectErrors, failServerActions, waitForSettled } from './helpers'

// Chặn theo sở thích P-C vòng 13 (docs/plans/so-thich-canh-bao.md): nút chặn / dòng nhắc + bỏ chặn ở trang sách, nút "Ẩn
// các sách có cảnh báo này", trang Sở thích. User riêng mỗi test, xóa ở finally (user_blocks xóa theo cascade). Chặn
// tác giả / NXB / danh mục của sách mẫu chỉ ghi user_blocks của user test, không sửa sách. Sách có nhãn cảnh báo là sách
// e2e riêng (createE2eBook, danh mục gốc ẩn, created_at năm 2000), nhãn gắn bằng service role; dọn bằng
// cleanupE2eAdminData(slugs) đúng slug của test. Giả định dữ liệu: scripts/e2e-seed.test.ts (prefs-book-account).
test.use({ storageState: NO_SESSION })

/** Danh mục lá một trang; BY_AUTHOR: tác giả chỉ có ở cuốn này trong danh mục (cùng bất biến với prefs-blocks-account) */
const CATEGORY = 'truyen-ngan-tan-van'
const BY_AUTHOR = 'muoi-chin-chan-dung-nha-van-cung-thoi'
const BY_PUBLISHER = 'buoc-qua-nuoc-mat-tu-khac-truong-thanh'
/** Mô tả ngắn nhất trong các sách có danh mục + tác giả + NXB: khối Sở thích gần màn hình đầu nhất (đo CLS) */
const SHORT = 'vong-buom'
/** Danh mục gốc và một sách ở danh mục con của nó */
const FOREIGN_ROOT = 'sach-ngoai-van'
const FOREIGN_CHILD_BOOK = 'how-not-to-be-a-twit-and-other-wisdom-from-roald-dahl'

const SUMMARY = 'Không muốn thấy sách như thế này?'
const HIDE_WARNINGS = 'Ẩn các sách có cảnh báo này'
const LABELS = { violence: 'Bạo lực / máu me', loss: 'Mất mát / tang thương' } as const

const main = (page: Page) => page.getByRole('main')
const blockedBox = (page: Page) => main(page).getByTestId('book-prefs-blocked')
const prefsMenu = (page: Page) => main(page).getByTestId('book-prefs-menu')
const slotOf = (page: Page, slug: string) =>
  main(page).locator('[data-book-slot]').filter({ has: page.locator(`a[data-book-link][href$="/sach/${slug}"]`) })

async function openPrefsMenu(page: Page) {
  const menu = prefsMenu(page)
  await menu.locator('summary').click()
  await expect(menu).toHaveAttribute('open', '')
  return menu
}

async function withUser<T>(label: string, run: (user: E2eUser) => Promise<T>) {
  const user = await createE2eUser(label)
  try {
    return await run(user)
  } finally {
    await deleteE2eUsers([user.id])
  }
}

/** Sách e2e có nhãn đã duyệt, trong danh mục gốc ẩn (không lên danh sách nào) */
async function createWarnedBook() {
  const root = await createE2eCategory({ active: false })
  const slugs = [root.slug]
  try {
    const book = await createE2eBook({ categoryId: root.id })
    slugs.push(book.slug)
    await setE2eBookWarnings(book.slug, ['violence', 'loss'])
    return { book, slugs }
  } catch (error) {
    await cleanupE2eAdminData(slugs)
    throw error
  }
}

/** Context mới chưa đăng nhập, cùng thiết bị với project (mobile-account: Pixel 7 đủ viewport, DSF, isMobile, hasTouch, UA) */
function deviceContext(browser: Browser, testInfo: TestInfo) {
  const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use
  const device = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }
  return browser.newContext({ ...device, baseURL, storageState: NO_SESSION })
}

/** Đánh dấu trên window: còn sau khi bấm = không tải lại trang */
const markWindow = (page: Page) => page.evaluate(() => Reflect.set(window, '__prefsNoReload', true))
const windowKept = (page: Page) => page.evaluate(() => Reflect.get(window, '__prefsNoReload') === true)

test('(a) khách: trang sách không có nút chặn / nút ẩn cảnh báo / dòng nhắc; trang Sở thích chuyển sang đăng nhập có next', async ({
  page,
}) => {
  const errors = collectErrors(page)
  const { book, slugs } = await createWarnedBook()
  try {
    for (const slug of [SHORT, book.slug]) {
      await page.goto(`/sach/${slug}`)
      await waitForSettled(page)
      await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible()
      await expect(main(page).getByTestId('book-prefs')).toHaveCount(0)
      await expect(main(page).getByText(SUMMARY)).toHaveCount(0)
      await expect(main(page).getByRole('button', { name: /Không muốn thấy|Bỏ chặn/ })).toHaveCount(0)
      await expect(main(page).getByRole('button', { name: HIDE_WARNINGS })).toHaveCount(0)
      await expect(main(page).getByTestId('warnings-hidden')).toHaveCount(0)
    }
    // Sách có nhãn: khung cảnh báo có, chỗ nút để trống
    await expect(main(page).getByTestId('content-warnings')).toContainText(LABELS.violence)

    await page.goto('/tai-khoan/so-thich')
    await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftai-khoan%2Fso-thich$/)
    expect(errors).toEqual([])
  } finally {
    await cleanupE2eAdminData(slugs)
  }
})

test('(b) thành viên chặn tác giả ở trang sách → dòng nhắc (không tải lại), danh mục che thẻ; bỏ chặn → hết che', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page)
  const target = await bookBlockTargets(BY_AUTHOR)
  const [author] = target.authors
  if (!author) throw new Error(`${BY_AUTHOR}: không có tác giả vai trò author`)
  await withUser(`${testInfo.project.name}-prefs-book-b`, async (user) => {
    await login(page, user)
    await page.goto(`/sach/${BY_AUTHOR}`)
    await waitForSettled(page)
    await markWindow(page)
    await expect(blockedBox(page)).toHaveCount(0)

    const menu = await openPrefsMenu(page)
    await menu.getByRole('button', { name: `Không muốn thấy tác giả «${author.name}»` }).click()
    await expect(blockedBox(page)).toContainText(`Bạn đã chặn tác giả «${author.name}»`)
    // Nút vừa bấm bị gỡ → focus về khung Sở thích (không rơi về body)
    await expect(main(page).getByTestId('book-prefs')).toBeFocused()
    await expect(blockedBox(page).getByRole('link', { name: 'Quản lý trong trang Sở thích' })).toHaveAttribute(
      'href',
      '/tai-khoan/so-thich',
    )
    // Đã chặn → không còn nút chặn tác giả đó
    await expect(main(page).getByRole('button', { name: `Không muốn thấy tác giả «${author.name}»` })).toHaveCount(0)
    expect(await windowKept(page)).toBe(true)
    expect((await userBlocksOf(user.id)).map((row) => [row.kind, row.author_id])).toEqual([['author', author.id]])

    // Breadcrumb → trang danh mục (chuyển trang phía client): thẻ sách đó bị che
    await main(page).locator(`nav a[href$="/danh-muc/${CATEGORY}"]`).click()
    await expect(page).toHaveURL(new RegExp(`/danh-muc/${CATEGORY}$`))
    await waitForSettled(page)
    await expect(slotOf(page, BY_AUTHOR).locator('[data-book-veil]')).toBeVisible()
    await expect(slotOf(page, BY_AUTHOR).locator('[data-book-link]')).toBeHidden()
    expect(await windowKept(page)).toBe(true)

    // Quay lại trang sách → Bỏ chặn → dòng nhắc mất
    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`/sach/${BY_AUTHOR}$`))
    await main(page).getByRole('button', { name: `Bỏ chặn tác giả «${author.name}»` }).click()
    await expect(blockedBox(page)).toHaveCount(0)
    await expect(prefsMenu(page)).toBeVisible()
    expect(await userBlocksOf(user.id)).toEqual([])

    await main(page).locator(`nav a[href$="/danh-muc/${CATEGORY}"]`).click()
    await expect(page).toHaveURL(new RegExp(`/danh-muc/${CATEGORY}$`))
    await waitForSettled(page)
    await expect(page.locator('style[data-testid="block-styles"]')).toHaveCount(0)
    await expect(slotOf(page, BY_AUTHOR).locator('[data-book-link]')).toBeVisible()
    await expect(slotOf(page, BY_AUTHOR).locator('[data-book-veil]')).toBeHidden()
    expect(await windowKept(page)).toBe(true)
    expect(errors).toEqual([])
  })
})

test('(c) "Ẩn các sách có cảnh báo này" chặn đủ 2 nhãn; bỏ 1 nhãn ở trang Sở thích → trang sách còn dòng nhắc nhãn kia', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page)
  const { book, slugs } = await createWarnedBook()
  try {
    await withUser(`${testInfo.project.name}-prefs-book-c`, async (user) => {
      await login(page, user)
      await page.goto(`/sach/${book.slug}`)
      await waitForSettled(page)
      const notice = main(page).getByTestId('content-warnings')
      await notice.getByRole('button', { name: HIDE_WARNINGS }).click()
      await expect(notice.getByTestId('warnings-hidden')).toHaveText('Bạn đã ẩn các sách có cảnh báo này.')
      await expect(notice.getByTestId('warnings-hidden')).toBeFocused()
      await expect(blockedBox(page)).toContainText(`Bạn đã chặn cảnh báo «${LABELS.violence}»`)
      await expect(blockedBox(page)).toContainText(`Bạn đã chặn cảnh báo «${LABELS.loss}»`)
      expect((await userBlocksOf(user.id)).map((row) => row.warning).sort()).toEqual(['loss', 'violence'])

      await page.goto('/tai-khoan/so-thich')
      const warnings = main(page).getByTestId('prefs-warning')
      await expect(warnings.getByRole('listitem')).toHaveCount(2)
      await expect(warnings).toContainText(LABELS.violence)
      await expect(warnings).toContainText(LABELS.loss)
      await warnings.getByRole('button', { name: `Bỏ chặn cảnh báo «${LABELS.loss}»` }).click()
      await expect(warnings.getByRole('listitem')).toHaveCount(1)
      await expect(warnings).not.toContainText(LABELS.loss)
      // Nhóm còn mục → focus về tiêu đề nhóm (gần dòng vừa bỏ), không rơi về body
      await expect(warnings.getByRole('heading', { level: 2 })).toBeFocused()

      await page.goto(`/sach/${book.slug}`)
      await waitForSettled(page)
      await expect(blockedBox(page)).toContainText(`Bạn đã chặn cảnh báo «${LABELS.violence}»`)
      await expect(blockedBox(page)).not.toContainText(LABELS.loss)
      // Còn nhãn chưa chặn → nút ẩn cảnh báo hiện lại
      await expect(main(page).getByRole('button', { name: HIDE_WARNINGS })).toBeVisible()
      expect(errors).toEqual([])
    })
  } finally {
    await cleanupE2eAdminData(slugs)
  }
})

test('(d) chặn danh mục cha → trang sách ở danh mục con nêu tên danh mục cha, không có nút "Không muốn thấy thể loại"', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page)
  const root = await categoryBySlug(FOREIGN_ROOT)
  await withUser(`${testInfo.project.name}-prefs-book-d`, async (user) => {
    await replaceUserBlocks(user.id, [{ kind: 'category', category_id: root.id }])
    await login(page, user)
    await page.goto(`/sach/${FOREIGN_CHILD_BOOK}`)
    await waitForSettled(page)
    await expect(blockedBox(page)).toContainText(`Bạn đã chặn thể loại «${root.name}»`)
    await expect(blockedBox(page).getByRole('listitem')).toHaveCount(1)
    // Còn tác giả / NXB chưa chặn → menu có, nhưng không có nút thể loại
    const menu = await openPrefsMenu(page)
    await expect(menu.getByRole('button', { name: /^Không muốn thấy tác giả/ }).first()).toBeVisible()
    await expect(main(page).getByRole('button', { name: /^Không muốn thấy thể loại/ })).toHaveCount(0)
    expect(errors).toEqual([])
  })
})

test('(e) trang Sở thích vi / en: nhóm + tên theo locale, bỏ chặn → mục mất, hết mục → trạng thái rỗng; thành viên B không thấy mục của A', async ({
  page,
  browser,
}, testInfo) => {
  const errors = collectErrors(page)
  const [root, byAuthor, byPublisher] = await Promise.all([
    categoryBySlug(FOREIGN_ROOT),
    bookBlockTargets(BY_AUTHOR),
    bookBlockTargets(BY_PUBLISHER),
  ])
  const [author] = byAuthor.authors
  if (!author) throw new Error(`${BY_AUTHOR}: không có tác giả vai trò author`)
  if (byPublisher.publisherId === null || !byPublisher.publisherName) throw new Error(`${BY_PUBLISHER}: không có NXB`)
  const publisherName = byPublisher.publisherName
  const userIds: string[] = []
  const contexts: BrowserContext[] = []
  try {
    const userA = await createE2eUser(`${testInfo.project.name}-prefs-page-a`)
    userIds.push(userA.id)
    const userB = await createE2eUser(`${testInfo.project.name}-prefs-page-b`)
    userIds.push(userB.id)
    await replaceUserBlocks(userA.id, [
      { kind: 'category', category_id: root.id },
      { kind: 'author', author_id: author.id },
      { kind: 'publisher', publisher_id: byPublisher.publisherId },
      { kind: 'warning', warning: 'violence' },
    ])

    await login(page, userA)
    await page.goto('/tai-khoan/so-thich')
    await expect(main(page).getByRole('heading', { level: 1, name: 'Sở thích' })).toBeVisible()
    await expect(main(page).getByTestId('prefs-count')).toHaveText('Đã chặn 4 / 50 mục')
    const vi = {
      category: ['Thể loại', root.name],
      author: ['Tác giả', author.name],
      publisher: ['Nhà xuất bản', publisherName],
      warning: ['Cảnh báo nội dung', LABELS.violence],
    } as const
    for (const [group, [heading, name]] of Object.entries(vi)) {
      const section = main(page).getByTestId(`prefs-${group}`)
      await expect(section.getByRole('heading', { level: 2 })).toHaveText(heading)
      await expect(section.getByRole('listitem')).toHaveCount(1)
      await expect(section).toContainText(name)
    }
    await expect(main(page).getByTestId('prefs-category').getByRole('link', { name: root.name })).toHaveAttribute(
      'href',
      `/danh-muc/${FOREIGN_ROOT}`,
    )

    await page.goto('/en/account/preferences')
    await expect(main(page).getByRole('heading', { level: 1, name: 'Preferences' })).toBeVisible()
    await expect(main(page).getByTestId('prefs-count')).toHaveText('Blocked: 4 / 50')
    const en = {
      category: ['Genres', root.name_en?.trim() || root.name],
      author: ['Authors', author.name],
      publisher: ['Publishers', publisherName],
      warning: ['Content notes', 'Violence / gore'],
    } as const
    for (const [group, [heading, name]] of Object.entries(en)) {
      const section = main(page).getByTestId(`prefs-${group}`)
      await expect(section.getByRole('heading', { level: 2 })).toHaveText(heading)
      await expect(section).toContainText(name)
    }
    // Bỏ chặn ở trang en
    await main(page).getByRole('button', { name: `Unblock the author “${author.name}”` }).click()
    await expect(main(page).getByTestId('prefs-author')).toHaveCount(0)
    await expect(main(page).getByTestId('prefs-count')).toHaveText('Blocked: 3 / 50')

    // Thành viên B: trang rỗng, không thấy mục của A
    const context = await deviceContext(browser, testInfo)
    contexts.push(context)
    const otherPage = await context.newPage()
    const otherErrors = collectErrors(otherPage)
    await login(otherPage, userB)
    await otherPage.goto('/tai-khoan/so-thich')
    await expect(main(otherPage).getByTestId('prefs-empty')).toContainText('Bạn chưa chặn mục nào')
    await expect(main(otherPage).getByTestId('prefs-count')).toHaveCount(0)
    await expect(main(otherPage)).not.toContainText(root.name)
    expect(otherErrors).toEqual([])

    // A bỏ hết → trạng thái rỗng
    await page.goto('/tai-khoan/so-thich')
    for (let left = 3; left > 0; left--) {
      await main(page).getByRole('button', { name: /^Bỏ chặn/ }).first().click()
      if (left > 1) await expect(main(page).getByTestId('prefs-count')).toHaveText(`Đã chặn ${left - 1} / 50 mục`)
    }
    await expect(main(page).getByTestId('prefs-empty')).toBeVisible()
    // Nhóm cuối biến mất → focus dự phòng về h1
    await expect(main(page).getByRole('heading', { level: 1, name: 'Sở thích' })).toBeFocused()
    expect(await userBlocksOf(userA.id)).toEqual([])
    expect(errors).toEqual([])
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
    await deleteE2eUsers(userIds)
  }
})

test('(f) đủ 50 mục: bấm chặn → câu lỗi ngay chỗ nút kèm link trang Sở thích, không thêm mục', async ({ page }, testInfo) => {
  const errors = collectErrors(page)
  const target = await bookBlockTargets(SHORT)
  const [author] = target.authors
  if (!author) throw new Error(`${SHORT}: không có tác giả vai trò author`)
  const authors = await createE2eAuthors(50)
  try {
    await withUser(`${testInfo.project.name}-prefs-book-f`, async (user) => {
      await replaceUserBlocks(user.id, authors.map((row) => ({ kind: 'author', author_id: row.id })))
      await login(page, user)
      await page.goto(`/sach/${SHORT}`)
      await waitForSettled(page)
      const menu = await openPrefsMenu(page)
      await menu.getByRole('button', { name: `Không muốn thấy tác giả «${author.name}»` }).click()
      const alert = menu.getByRole('alert')
      await expect(alert).toContainText('Bạn đã chặn đủ 50 mục')
      await expect(alert.getByRole('link', { name: 'Mở trang Sở thích' })).toHaveAttribute('href', '/tai-khoan/so-thich')
      await expect(blockedBox(page)).toHaveCount(0)
      const rows = await userBlocksOf(user.id)
      expect(rows).toHaveLength(50)
      expect(rows.some((row) => row.author_id === author.id)).toBe(false)
      expect(errors).toEqual([])
    })
  } finally {
    await cleanupE2eAdminData(authors.map((row) => row.slug))
  }
})

test('(g) mất mạng khi bấm chặn → NETWORK_ERROR ngay chỗ nút, không đổi gì', async ({ page }, testInfo) => {
  // Chỉ bắt lỗi không ai xử lý (trang lỗi): useFormAction tự ghi console.error khi request không tới server (có chủ ý)
  const uncaught: string[] = []
  page.on('pageerror', (error) => uncaught.push(error.message))
  const target = await bookBlockTargets(SHORT)
  const [author] = target.authors
  if (!author) throw new Error(`${SHORT}: không có tác giả vai trò author`)
  await withUser(`${testInfo.project.name}-prefs-book-g`, async (user) => {
    await login(page, user)
    await page.goto(`/sach/${SHORT}`)
    await waitForSettled(page)
    const menu = await openPrefsMenu(page)
    const button = menu.getByRole('button', { name: `Không muốn thấy tác giả «${author.name}»` })
    await expect(button).toBeEnabled()
    await failServerActions(page, `**/sach/${SHORT}`)
    await button.click()
    await expect(menu.getByRole('alert')).toContainText('Không kết nối được máy chủ.')
    await expect(blockedBox(page)).toHaveCount(0)
    await expect(button).toBeVisible()
    expect(await userBlocksOf(user.id)).toEqual([])
    await expect(page.getByTestId('error-page')).toHaveCount(0)
    expect(uncaught).toEqual([])
  })
})

/**
 * Tổng layout-shift của trang sách từ lúc tải tới waitForSettled (+ ảnh trong khung nhìn đã tải). Đo ở lần tải lại
 * (font đã có trong bộ đệm: không tính dịch chuyển do đổi font lần đầu).
 */
async function bookPageCls(page: Page, slug: string) {
  await page.addInitScript({
    content: `window.__cls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value
      }).observe({ type: 'layout-shift', buffered: true })`,
  })
  await page.goto(`/sach/${slug}`)
  await waitForSettled(page)
  await page.reload()
  await waitForSettled(page)
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('main img')].every((img) => {
          if (!(img instanceof HTMLImageElement)) return true
          const box = img.getBoundingClientRect()
          return img.complete || box.top >= window.innerHeight || box.bottom <= 0
        }),
      ),
    )
    .toBe(true)
  return page.evaluate(() => Number(Reflect.get(window, '__cls')))
}

function reportCls(testInfo: TestInfo, label: string, cls: number) {
  testInfo.annotations.push({ type: 'cls', description: `${testInfo.project.name} ${label}: ${cls}` })
  console.log(`[cls] ${testInfo.project.name} ${label}: ${cls}`)
}

test('(h) CLS trang sách < 0.01: khách, thành viên chưa chặn, thành viên đã chặn 1 mục', async ({
  page,
  browser,
}, testInfo) => {
  const target = await bookBlockTargets(SHORT)
  const [author] = target.authors
  if (!author) throw new Error(`${SHORT}: không có tác giả vai trò author`)
  const contexts: BrowserContext[] = []
  const userIds: string[] = []
  try {
    const guestContext = await deviceContext(browser, testInfo)
    contexts.push(guestContext)
    const guest = await guestContext.newPage()
    const guestErrors = collectErrors(guest)
    const guestCls = await bookPageCls(guest, SHORT)
    reportCls(testInfo, 'khách', guestCls)
    await expect(main(guest).getByTestId('book-prefs')).toHaveCount(0)

    const plain = await createE2eUser(`${testInfo.project.name}-prefs-cls-plain`)
    userIds.push(plain.id)
    const plainErrors = collectErrors(page)
    await login(page, plain)
    const plainCls = await bookPageCls(page, SHORT)
    reportCls(testInfo, 'thành viên chưa chặn', plainCls)
    await expect(prefsMenu(page)).toBeVisible()
    await expect(blockedBox(page)).toHaveCount(0)

    const blocked = await createE2eUser(`${testInfo.project.name}-prefs-cls-blocked`)
    userIds.push(blocked.id)
    await replaceUserBlocks(blocked.id, [{ kind: 'author', author_id: author.id }])
    const blockedContext = await deviceContext(browser, testInfo)
    contexts.push(blockedContext)
    const blockedPage = await blockedContext.newPage()
    const blockedErrors = collectErrors(blockedPage)
    await login(blockedPage, blocked)
    const blockedCls = await bookPageCls(blockedPage, SHORT)
    reportCls(testInfo, 'thành viên đã chặn 1 mục', blockedCls)
    await expect(blockedBox(blockedPage).getByRole('listitem')).toHaveCount(1)

    expect(guestCls).toBeLessThan(0.01)
    expect(plainCls).toBeLessThan(0.01)
    expect(blockedCls).toBeLessThan(0.01)
    expect([...guestErrors, ...plainErrors, ...blockedErrors]).toEqual([])
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
    await deleteE2eUsers(userIds)
  }
})

test('(h) CLS trang sách có nhãn cảnh báo < 0.01: khách, thành viên chưa chặn, thành viên đã ẩn mọi nhãn', async ({
  page,
  browser,
}, testInfo) => {
  // Chỗ nút "Ẩn các sách có cảnh báo này" nằm giữa cột (trên Mô tả); sách e2e không có mô tả → khung cảnh báo gần màn
  // hình đầu nhất. Thành viên đã ẩn mọi nhãn còn thấy khung "Bạn đã chặn …" (2 dòng) cuối cột: cao hơn chỗ giữ sẵn (chỉ
  // giữ chỗ cho summary thu gọn); khung này dưới màn hình đầu thì không tính vào CLS, như ca đã chặn ở (h) trên
  const { book, slugs } = await createWarnedBook()
  const contexts: BrowserContext[] = []
  const userIds: string[] = []
  try {
    const guestContext = await deviceContext(browser, testInfo)
    contexts.push(guestContext)
    const guest = await guestContext.newPage()
    const guestErrors = collectErrors(guest)
    const guestCls = await bookPageCls(guest, book.slug)
    reportCls(testInfo, 'nhãn, khách', guestCls)
    await expect(main(guest).getByRole('button', { name: HIDE_WARNINGS })).toHaveCount(0)

    const plain = await createE2eUser(`${testInfo.project.name}-prefs-cls-warn-plain`)
    userIds.push(plain.id)
    const plainErrors = collectErrors(page)
    await login(page, plain)
    const plainCls = await bookPageCls(page, book.slug)
    reportCls(testInfo, 'nhãn, thành viên chưa chặn', plainCls)
    await expect(main(page).getByRole('button', { name: HIDE_WARNINGS })).toBeVisible()

    const hidden = await createE2eUser(`${testInfo.project.name}-prefs-cls-warn-hidden`)
    userIds.push(hidden.id)
    await replaceUserBlocks(hidden.id, [
      { kind: 'warning', warning: 'violence' },
      { kind: 'warning', warning: 'loss' },
    ])
    const hiddenContext = await deviceContext(browser, testInfo)
    contexts.push(hiddenContext)
    const hiddenPage = await hiddenContext.newPage()
    const hiddenErrors = collectErrors(hiddenPage)
    await login(hiddenPage, hidden)
    const hiddenCls = await bookPageCls(hiddenPage, book.slug)
    reportCls(testInfo, 'nhãn, thành viên đã ẩn mọi nhãn', hiddenCls)
    await expect(main(hiddenPage).getByTestId('warnings-hidden')).toBeVisible()

    expect(guestCls).toBeLessThan(0.01)
    expect(plainCls).toBeLessThan(0.01)
    expect(hiddenCls).toBeLessThan(0.01)
    expect([...guestErrors, ...plainErrors, ...hiddenErrors]).toEqual([])
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
    await deleteE2eUsers(userIds)
    await cleanupE2eAdminData(slugs)
  }
})

test('(h) màn 320px: câu "Bạn đã ẩn các sách có cảnh báo này." (có thể 2 dòng) vừa chỗ giữ sẵn h-9, khung cảnh báo cao bằng của khách, CLS < 0.01', async ({
  browser,
}, testInfo) => {
  // Quyết định (11): ở 320px câu xuống 2 dòng; leading-tight giữ 2 dòng ≤ 36px (h-9 của chỗ giữ sẵn). Font trên CI có
  // thể đo khác máy dev 1px: kiểm chiều cao, ghi số dòng vào annotation thay vì đòi đúng 2 dòng
  const { book, slugs } = await createWarnedBook()
  const contexts: BrowserContext[] = []
  const userIds: string[] = []
  const narrow = async () => {
    const { baseURL, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use
    const context = await browser.newContext({
      userAgent,
      deviceScaleFactor,
      isMobile,
      hasTouch,
      viewport: { width: 320, height: 640 },
      baseURL,
      storageState: NO_SESSION,
    })
    contexts.push(context)
    return context.newPage()
  }
  const noticeHeight = (page: Page) =>
    main(page)
      .getByTestId('content-warnings')
      .evaluate((element) => element.getBoundingClientRect().height)
  try {
    const guest = await narrow()
    const guestErrors = collectErrors(guest)
    const guestCls = await bookPageCls(guest, book.slug)
    reportCls(testInfo, '320px, nhãn, khách', guestCls)
    const guestHeight = await noticeHeight(guest)

    const hidden = await createE2eUser(`${testInfo.project.name}-prefs-320-hidden`)
    userIds.push(hidden.id)
    await replaceUserBlocks(hidden.id, [
      { kind: 'warning', warning: 'violence' },
      { kind: 'warning', warning: 'loss' },
    ])
    const page = await narrow()
    const errors = collectErrors(page)
    await login(page, hidden)
    const cls = await bookPageCls(page, book.slug)
    reportCls(testInfo, '320px, nhãn, thành viên đã ẩn mọi nhãn', cls)
    const sentence = main(page).getByTestId('warnings-hidden')
    await expect(sentence).toHaveText('Bạn đã ẩn các sách có cảnh báo này.')
    const metrics = await sentence.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)))
      return { height: element.getBoundingClientRect().height, lines: lines.size }
    })
    testInfo.annotations.push({
      type: 'warnings-hidden-320',
      description: `${testInfo.project.name}: cao ${metrics.height}px, ${metrics.lines} dòng; khung cảnh báo khách ${guestHeight}px`,
    })
    expect(metrics.height).toBeLessThanOrEqual(36)
    expect(Math.abs((await noticeHeight(page)) - guestHeight)).toBeLessThanOrEqual(0.5)
    expect(guestCls).toBeLessThan(0.01)
    expect(cls).toBeLessThan(0.01)
    expect([...guestErrors, ...errors]).toEqual([])
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
    await deleteE2eUsers(userIds)
    await cleanupE2eAdminData(slugs)
  }
})
