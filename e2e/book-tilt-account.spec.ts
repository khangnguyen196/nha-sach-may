import { expect, test, type Locator, type Page } from '@playwright/test'
import { bookBlockTargets, createE2eUser, deleteE2eUsers, replaceUserBlocks } from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { collectErrors, waitForSettled } from './helpers'

// Nghiêng bìa sách (đợt sach-nghieng-3d): thẻ đang bị che "Đã ẩn theo sở thích" không nghiêng khi rê chuột lên ô mờ (link
// sách bị che bằng visibility: hidden, ô mờ là anh em của link chứ không nằm trong link → link không :hover). User riêng
// mỗi lần chạy, mục chặn chèn bằng service role, xóa user ở finally. Chỉ chặn tác giả của sách mẫu, không sửa sách.
// Dùng chung dữ liệu của prefs-blocks-account.spec (danh mục một trang, tác giả chỉ có ở cuốn đó): scripts/e2e-seed.test.ts.
test.use({ storageState: NO_SESSION })

const CATEGORY = 'truyen-ngan-tan-van'
const BY_AUTHOR = 'muoi-chin-chan-dung-nha-van-cung-thoi'

const slotOf = (page: Page, slug: string) =>
  page
    .getByRole('main')
    .locator('[data-book-slot]')
    .filter({ has: page.locator(`a[data-book-link][href$="/sach/${slug}"]`) })
const transformOf = (cover: Locator) => cover.evaluate((element) => getComputedStyle(element).transform)

test('thẻ bị che: rê chuột lên ô mờ → bìa trong khung không nghiêng; thẻ chưa che vẫn nghiêng', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, 'Hover chỉ có ở máy tính')
  const errors = collectErrors(page)
  const target = await bookBlockTargets(BY_AUTHOR)
  const [authorId] = target.authorIds
  if (authorId === undefined) throw new Error(`${BY_AUTHOR}: không có tác giả vai trò author`)
  const user = await createE2eUser(`${testInfo.project.name}-book-tilt`)
  try {
    await replaceUserBlocks(user.id, [{ kind: 'author', author_id: authorId }])
    await login(page, user)
    await page.goto(`/danh-muc/${CATEGORY}`)
    await expect(page.locator('style[data-testid="block-styles"][data-ready]').first()).toBeAttached()
    await waitForSettled(page)

    const blocked = slotOf(page, BY_AUTHOR)
    const veil = blocked.locator('[data-book-veil]')
    const blockedLink = blocked.locator('[data-book-link]')
    const blockedCover = blocked.locator('.book-tilt-cover')
    await expect(veil).toBeVisible()
    await expect(blockedLink).toBeHidden()

    // Đối chứng: thẻ chưa che cùng trang nghiêng khi rê chuột
    const open = page.getByRole('main').locator('[data-book-slot] > a.book-tilt').filter({ visible: true }).first()
    await open.hover()
    await expect.poll(() => transformOf(open.locator('.book-tilt-cover'))).toMatch(/^matrix3d\(/)

    await veil.hover()
    await expect.poll(() => transformOf(open.locator('.book-tilt-cover'))).toBe('none')
    expect(await blockedLink.evaluate((element) => element.matches(':hover'))).toBe(false)
    expect(await transformOf(blockedCover)).toBe('none')
    expect(await blockedCover.evaluate((element) => element.getAnimations().length)).toBe(0)
    expect(errors).toEqual([])
  } finally {
    await deleteE2eUsers([user.id])
  }
})
