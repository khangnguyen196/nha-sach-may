import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'
import {
  bookBlockTargets,
  categoryIdBySlug,
  createE2eUser,
  deleteE2eUsers,
  replaceUserBlocks,
} from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { collectErrors, waitForSettled } from './helpers'

// Chặn theo sở thích P-C (docs/plans/so-thich-canh-bao.md): thẻ bị chặn ở danh sách thành ô mờ cùng khung, link sách ẩn
// thật (không Tab, không trong cây a11y), "Xem" hiện lại riêng cuốn đó trong lần xem này. User riêng mỗi test, mục chặn
// chèn bằng service role (action chặn có ở vòng 13), xóa user ở finally (user_blocks xóa theo cascade). Chỉ chặn tác
// giả / NXB / danh mục của sách mẫu, không sửa sách. Giả định dữ liệu: scripts/e2e-seed.test.ts (prefs-blocks-account).
test.use({ storageState: NO_SESSION })

/** Danh mục lá một trang, ≥ 4 sách; 2 cuốn dưới đây bị chặn (tác giả / NXB chỉ có ở cuốn đó), còn lại không */
const CATEGORY = 'truyen-ngan-tan-van'
const BY_AUTHOR = 'muoi-chin-chan-dung-nha-van-cung-thoi'
const BY_PUBLISHER = 'buoc-qua-nuoc-mat-tu-khac-truong-thanh'
/** Danh mục gốc (kệ "Sách ngoại văn" ở trang chủ) và một danh mục con của nó */
const FOREIGN_ROOT = 'sach-ngoai-van'
const FOREIGN_CHILD = 'ngoai-van-thieu-nhi'
const HIDDEN_TEXT = 'Đã ẩn theo sở thích của bạn'

const slots = (scope: Locator) => scope.locator('[data-book-slot]')
const slotOf = (page: Page, slug: string) =>
  slots(page.getByRole('main')).filter({ has: page.locator(`a[data-book-link][href$="/sach/${slug}"]`) })
const veilOf = (slot: Locator) => slot.locator('[data-book-veil]')
const revealOf = (slot: Locator) => veilOf(slot).getByRole('button', { name: 'Xem sách đã ẩn' })
const blockStyles = (page: Page) => page.locator('style[data-testid="block-styles"]')

/** Listener của nút Xem đã gắn (RevealBlocked đặt data-ready trong effect) và trang đã ổn định */
async function waitForRevealReady(page: Page) {
  await expect(page.locator('style[data-testid="block-styles"][data-ready]').first()).toBeAttached()
  await waitForSettled(page)
}

async function blockedSetup(label: string, rows: Parameters<typeof replaceUserBlocks>[1]) {
  const user = await createE2eUser(label)
  try {
    await replaceUserBlocks(user.id, rows)
  } catch (error) {
    await deleteE2eUsers([user.id])
    throw error
  }
  return user
}

async function categoryBlockTargets() {
  const [byAuthor, byPublisher] = await Promise.all([bookBlockTargets(BY_AUTHOR), bookBlockTargets(BY_PUBLISHER)])
  const [authorId] = byAuthor.authorIds
  if (authorId === undefined) throw new Error(`${BY_AUTHOR}: không có tác giả vai trò author`)
  if (byPublisher.publisherId === null) throw new Error(`${BY_PUBLISHER}: không có NXB`)
  return { byAuthor, byPublisher, authorId, publisherId: byPublisher.publisherId }
}

test('(a)(b)(f) lưới danh mục: ô mờ cùng khung thẻ cạnh bên, link bị che không nhận focus / không trong cây a11y, Xem hiện đúng cuốn, tải lại che lại, không CLS', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page)
  const { byAuthor, byPublisher, authorId, publisherId } = await categoryBlockTargets()
  const user = await blockedSetup(`${testInfo.project.name}-prefs-grid`, [
    { kind: 'author', author_id: authorId },
    { kind: 'publisher', publisher_id: publisherId },
  ])
  try {
    await login(page, user)
    await page.goto(`/danh-muc/${CATEGORY}`)
    await waitForRevealReady(page)
    const main = page.getByRole('main')
    const css = await blockStyles(page).first().textContent()
    expect(css).toContain(`[data-a~="${authorId}"]`)
    expect(css).toContain(`[data-p="${publisherId}"]`)

    const blockedA = slotOf(page, BY_AUTHOR)
    const blockedP = slotOf(page, BY_PUBLISHER)
    await expect(blockedA).toHaveCount(1)
    await expect(blockedP).toHaveCount(1)
    for (const slot of [blockedA, blockedP]) {
      await expect(veilOf(slot)).toBeVisible()
      await expect(veilOf(slot)).toContainText(HIDDEN_TEXT)
      await expect(slot.locator('[data-book-link]')).toBeHidden()
    }
    // Đúng 2 thẻ bị che, các thẻ khác hiện như cũ
    const total = await slots(main).count()
    expect(total).toBeGreaterThanOrEqual(4)
    await expect(main.locator('[data-book-veil]').filter({ visible: true })).toHaveCount(2)
    await expect(main.locator('[data-book-link]').filter({ visible: true })).toHaveCount(total - 2)

    // (3a) Không trong cây a11y: không có link mang tên sách bị chặn
    await expect(main.getByRole('link', { name: byAuthor.title })).toHaveCount(0)
    await expect(main.getByRole('link', { name: byPublisher.title })).toHaveCount(0)

    // Ô mờ cùng khung thẻ chưa chặn cùng hàng (±1px)
    const boxes = await slots(main).evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        const veil = element.querySelector('[data-book-veil]')
        const veilBox = veil?.getBoundingClientRect()
        const link = element.querySelector('[data-book-link]')?.getBoundingClientRect()
        return {
          blocked: veil !== null && getComputedStyle(veil).display !== 'none',
          y: box.top,
          width: box.width,
          height: box.height,
          linkWidth: link?.width ?? 0,
          linkHeight: link?.height ?? 0,
          veilWidth: veilBox?.width ?? 0,
          veilHeight: veilBox?.height ?? 0,
        }
      }),
    )
    const pair = boxes
      .filter((box) => box.blocked)
      .flatMap((blocked) => {
        const neighbor = boxes.find((box) => !box.blocked && Math.abs(box.y - blocked.y) <= 1)
        return neighbor ? [{ blocked, neighbor }] : []
      })[0]
    if (!pair) throw new Error('Không có thẻ bị che nào có thẻ chưa chặn cùng hàng')
    // Rộng bằng thẻ (link) cạnh bên; cao bằng ô của thẻ cạnh bên (ô cùng hàng cao bằng nhau), không thấp hơn thẻ
    expect(pair.blocked.veilWidth).toBeGreaterThan(0)
    expect(Math.abs(pair.blocked.veilWidth - pair.neighbor.linkWidth)).toBeLessThanOrEqual(1)
    expect(Math.abs(pair.blocked.veilWidth - pair.neighbor.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(pair.blocked.veilHeight - pair.neighbor.height)).toBeLessThanOrEqual(1)
    expect(pair.blocked.veilHeight).toBeGreaterThanOrEqual(pair.neighbor.linkHeight - 1)

    // (3a) Link bị che không nhận focus: focus() không có tác dụng; Shift+Tab từ nút Xem ra khỏi thẻ (bỏ qua link đứng
    // trước nút trong DOM), Tab quay lại đúng nút Xem
    const hiddenLink = blockedA.locator('[data-book-link]')
    const linkFocused = await hiddenLink.evaluate((element) => {
      element.focus()
      return document.activeElement === element
    })
    expect(linkFocused).toBe(false)
    const reveal = revealOf(blockedA)
    await reveal.focus()
    await page.keyboard.press('Shift+Tab')
    expect(await blockedA.evaluate((slot) => slot.contains(document.activeElement))).toBe(false)
    await page.keyboard.press('Tab')
    await expect(reveal).toBeFocused()

    // (b) Xem → hiện đúng cuốn đó, focus vào link; cuốn kia vẫn che
    await reveal.click()
    await expect(blockedA).toHaveAttribute('data-revealed', '')
    await expect(veilOf(blockedA)).toBeHidden()
    await expect(main.getByRole('link', { name: byAuthor.title })).toBeVisible()
    await expect(hiddenLink).toBeFocused()
    await expect(veilOf(blockedP)).toBeVisible()
    await expect(main.getByRole('link', { name: byPublisher.title })).toHaveCount(0)

    // (f) Tải lại: che lại cả hai; tổng layout-shift cả trang < 0.01 (chặt hơn mục tiêu 0.1 của dự án: che chỉ đổi
    // visibility + ô mờ absolute, không được dịch chuyển gì). Đo ở lần tải lại (font đã có trong bộ đệm: không tính dịch
    // chuyển do đổi font lần đầu)
    await page.addInitScript({
      content: `window.__cls = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value
        }).observe({ type: 'layout-shift', buffered: true })`,
    })
    await page.reload()
    await waitForSettled(page)
    await expect(blockedA).not.toHaveAttribute('data-revealed')
    await expect(veilOf(blockedA)).toBeVisible()
    await expect(veilOf(blockedP)).toBeVisible()
    await expect(main.getByRole('link', { name: byAuthor.title })).toHaveCount(0)
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
    const cls = await page.evaluate(() => Number(Reflect.get(window, '__cls')))
    expect(cls).toBeLessThan(0.01)
    expect(errors).toEqual([])
  } finally {
    await deleteE2eUsers([user.id])
  }
})

test('(c)(d) chặn danh mục cha: kệ "Sách ngoại văn" ở trang chủ và trang danh mục con bị che hết, danh mục khác không', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page)
  const user = await blockedSetup(`${testInfo.project.name}-prefs-root`, [
    { kind: 'category', category_id: await categoryIdBySlug(FOREIGN_ROOT) },
  ])
  try {
    await login(page, user)
    await page.goto('/')
    await waitForRevealReady(page)
    const main = page.getByRole('main')

    const foreign = main.locator('section[aria-labelledby="foreign-books"]')
    const foreignCount = await slots(foreign).count()
    expect(foreignCount).toBeGreaterThan(0)
    await expect(foreign.locator('[data-book-veil]').filter({ visible: true })).toHaveCount(foreignCount)
    await expect(foreign.locator('[data-book-link]').filter({ visible: true })).toHaveCount(0)

    const newArrivals = main.locator('section[aria-labelledby="new-arrivals"]')
    const newCount = await slots(newArrivals).count()
    expect(newCount).toBeGreaterThan(0)
    await expect(newArrivals.locator('[data-book-veil]').filter({ visible: true })).toHaveCount(0)
    await expect(newArrivals.locator('[data-book-link]').filter({ visible: true })).toHaveCount(newCount)

    // Sách gắn vào danh mục con: chặn gốc → che ở trang danh mục con
    await page.goto(`/danh-muc/${FOREIGN_CHILD}`)
    await waitForRevealReady(page)
    const childCount = await slots(main).count()
    expect(childCount).toBeGreaterThan(0)
    await expect(main.locator('[data-book-veil]').filter({ visible: true })).toHaveCount(childCount)
    await expect(main.locator('[data-book-link]').filter({ visible: true })).toHaveCount(0)

    // Style đã có hiệu lực (đếm 0 không qua sớm vì style chưa tới)
    await page.goto(`/danh-muc/${CATEGORY}`)
    await waitForRevealReady(page)
    await expect(main.locator('[data-book-veil]').filter({ visible: true })).toHaveCount(0)
    expect(errors).toEqual([])
  } finally {
    await deleteE2eUsers([user.id])
  }
})

test('(e) thành viên A chặn → A thấy ô mờ; khách chưa đăng nhập và thành viên B: không ô mờ, không <style> chặn', async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  const { byAuthor, authorId, publisherId } = await categoryBlockTargets()
  const userIds: string[] = []
  const contexts: BrowserContext[] = []
  try {
    const blocker = await blockedSetup(`${testInfo.project.name}-prefs-a`, [
      { kind: 'author', author_id: authorId },
      { kind: 'publisher', publisher_id: publisherId },
    ])
    userIds.push(blocker.id)
    const other = await createE2eUser(`${testInfo.project.name}-prefs-b`)
    userIds.push(other.id)

    // A xem trước: <style> theo phiên của A không được dùng lại cho khách / B (cache chung, RLS)
    const blockerErrors = collectErrors(page)
    await login(page, blocker)
    await page.goto(`/danh-muc/${CATEGORY}`)
    await waitForRevealReady(page)
    await expect(page.getByRole('main').locator('[data-book-veil]').filter({ visible: true })).toHaveCount(2)
    expect(blockerErrors).toEqual([])

    // Cùng kích thước khung nhìn với project (mobile: lưới 2 cột)
    const viewport = page.viewportSize()
    const viewerPage = async () => {
      const context = await browser.newContext({ baseURL, storageState: NO_SESSION, ...(viewport && { viewport }) })
      contexts.push(context)
      return context.newPage()
    }
    const guestPage = await viewerPage()
    const otherPage = await viewerPage()
    await login(otherPage, other)
    for (const viewer of [guestPage, otherPage]) {
      const errors = collectErrors(viewer)
      await viewer.goto(`/danh-muc/${CATEGORY}`)
      await waitForSettled(viewer)
      const main = viewer.getByRole('main')
      expect(await slots(main).count()).toBeGreaterThanOrEqual(4)
      await expect(blockStyles(viewer)).toHaveCount(0)
      await expect(main.locator('[data-book-veil]').filter({ visible: true })).toHaveCount(0)
      await expect(main.getByRole('link', { name: byAuthor.title })).toBeVisible()
      expect(errors).toEqual([])
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
    await deleteE2eUsers(userIds)
  }
})
