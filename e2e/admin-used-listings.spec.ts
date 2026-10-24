import { expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import {
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  deleteUsedListingAsService,
  removeUsedPhotoAsService,
  setBookPrices,
  signedInClient,
  USED_PHOTO_BUCKET,
  usedListingRow,
  usedListingUpdatedAt,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import { adminTest as test, main } from './admin'
import { login, NO_SESSION } from './auth'
import { vnd } from './cart'
import { collectErrors, waitForHydration } from './helpers'

// Admin duyệt / từ chối / gỡ tin sách cũ (docs/plans/cho-sach-cu.md, P-B vòng 8, 9, 10). Người bán + người dùng thường +
// sách test tạo riêng mỗi lần chạy; tin tạo bằng RPC create_used_listing theo phiên người bán, ảnh thật trong bucket (tải
// bằng phiên người bán). Dọn ở afterAll (chạy cả khi test đỏ): deleteE2eUsers (tin → ảnh trong thư mục người bán → user), rồi
// cleanupE2eAdminData đúng slug của spec (sách sau tin: book_id restrict).

test.describe.configure({ mode: 'serial' })

type Client = Awaited<ReturnType<typeof signedInClient>>

const BOOK_PRICE = 80_000
const ORIGINAL_PRICE = 100_000
const LISTING_PRICE = 70_000
/** Câu riêng của admin cho LISTING_STATUS_CHANGED (admin.usedListings.listingChanged) */
const LISTING_CHANGED =
  'Người bán vừa sửa tin hoặc tin vừa đổi trạng thái. Trang đã hiện nội dung mới nhất, bạn xem lại trước khi duyệt.'
/** errors.ITEM_DELETED (mục vừa bị xóa ở nơi khác) */
const ITEM_DELETED = 'Mục này vừa bị xóa ở nơi khác. Bạn tải lại danh sách để xem dữ liệu mới nhất.'

let seller: E2eUser
let customer: E2eUser
let sellerClient: Client
let book: E2eAdminBook
/** Sách riêng cho ca (f): hạ giá gốc xuống dưới giá tin, không ảnh hưởng ca khác */
let priceBook: E2eAdminBook
const slugs: string[] = []

test.beforeAll(async () => {
  test.setTimeout(60_000)
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  ;[book, priceBook] = await Promise.all([
    createE2eBook({ categoryId: leaf.id, price: BOOK_PRICE, originalPrice: ORIGINAL_PRICE }),
    createE2eBook({ categoryId: leaf.id, price: BOOK_PRICE, originalPrice: ORIGINAL_PRICE }),
  ])
  slugs.push(book.slug, priceBook.slug)
  ;[seller, customer] = await Promise.all([createE2eUser('admin-used-seller'), createE2eUser('admin-used-customer')])
  sellerClient = await signedInClient(seller)
})

test.afterAll(async () => {
  await deleteE2eUsers([seller, customer].filter((user) => user !== undefined).map((user) => user.id))
  await cleanupE2eAdminData(slugs)
})

/** Ảnh thật (WebP nhỏ) tải bằng phiên người bán vào thư mục của họ (policy: chủ thư mục, đúng mẫu tên) */
async function uploadPhoto() {
  const path = `${seller.id}/${randomUUID()}.webp`
  const webp = await sharp({ create: { width: 60, height: 80, channels: 3, background: '#8a5' } }).webp().toBuffer()
  const { error } = await sellerClient.storage.from(USED_PHOTO_BUCKET).upload(path, webp, { contentType: 'image/webp' })
  if (error) throw new Error(`upload: ${error.message}`)
  return path
}

/** Tin chờ duyệt của người bán (RPC theo phiên người bán, như form đăng tin) */
async function createPendingListing({ bookId = book.id, photos = 1 } = {}) {
  const paths = await Promise.all(Array.from({ length: photos }, () => uploadPhoto()))
  const { data, error } = await sellerClient.rpc('create_used_listing', {
    p_book_id: bookId,
    p_condition: 'good',
    p_price: LISTING_PRICE,
    p_description: 'Sách e2e admin',
    p_photos: paths,
  })
  if (error) throw new Error(`create_used_listing: ${error.message}`)
  return { id: data, photos: paths }
}

/** Mở trang chi tiết tin, chờ khối duyệt hydrate (nút gửi khóa tới khi hydrate) */
async function openListing(page: Page, id: number) {
  await page.goto(`/admin/sach-cu/${id}`)
  await expect(main(page).getByRole('heading', { name: 'Duyệt tin sách cũ', level: 1 })).toBeVisible()
  await waitForHydration(page, 'main [data-testid="listing-review"] button')
}

const review = (page: Page) => main(page).getByTestId('listing-review')
const feedback = (page: Page) => main(page).getByTestId('listing-review-feedback')
const status = (page: Page) => main(page).getByTestId('listing-status')
const listRow = (page: Page, id: number) =>
  main(page).locator(`[data-testid="admin-used-listing"][data-listing-id="${id}"]`)

test('(a) tin chờ duyệt hiện ở /admin/sach-cu (mặc định), ảnh tải được; Duyệt → approved, biến khỏi lọc chờ duyệt', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const errors = collectErrors(page)
  const { id } = await createPendingListing()

  // Giả định: lúc chạy có < 25 tin chờ duyệt (một trang admin; chờ duyệt xếp cũ nhất trước nên tin mới nằm cuối). Tin
  // của mọi spec song song đều được dọn sau khi chạy; đủ 25 thì mở thẳng /admin/sach-cu/<id> thay cho bấm từ bảng.
  await page.goto('/admin/sach-cu')
  await expect(main(page).getByRole('link', { name: 'Chờ duyệt' })).toHaveAttribute('aria-current', 'true')
  const row = listRow(page, id)
  await expect(row).toContainText(book.title)
  await expect(row).toContainText(vnd(LISTING_PRICE))
  await expect(row).toContainText(seller.fullName)
  await expect(row.getByTestId('listing-status')).toHaveText('Chờ duyệt')
  // Ảnh đầu (link ký theo request, unoptimized) tải được thật
  const thumbnail = row.locator('img')
  await expect
    .poll(() => thumbnail.evaluate((image: HTMLImageElement) => (image.complete ? image.naturalWidth : 0)), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0)

  await row.getByRole('link', { name: book.title }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/sach-cu/${id}$`))
  await waitForHydration(page, 'main [data-testid="listing-review"] button')
  await expect(main(page).getByTestId('used-listing-max-price')).toHaveText(vnd(ORIGINAL_PRICE))
  await review(page).getByRole('button', { name: 'Duyệt tin' }).click()
  await expect(feedback(page)).toContainText('Đã duyệt tin', { timeout: 15_000 })
  await expect(status(page)).toHaveText('Đang bán')
  await expect(review(page).getByRole('button', { name: 'Duyệt tin' })).toHaveCount(0)
  const saved = await usedListingRow(id)
  expect(saved?.status).toBe('approved')
  expect(saved?.approved_at).not.toBeNull()

  // Lọc mặc định (chờ duyệt) đã render xong (chip nằm trong cùng Suspense với bảng) → tin không còn ở đó
  await page.goto('/admin/sach-cu')
  await expect(main(page).getByRole('link', { name: 'Chờ duyệt' })).toHaveAttribute('aria-current', 'true')
  await expect(listRow(page, id)).toHaveCount(0)
  await page.goto('/admin/sach-cu?status=approved')
  await expect(listRow(page, id).getByTestId('listing-status')).toHaveText('Đang bán')
  expect(errors).toEqual([])
})

test('(b) Từ chối không lý do → lỗi dưới ô, vẫn chờ duyệt; có lý do → rejected, lý do đã cắt khoảng trắng', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const errors = collectErrors(page)
  const { id } = await createPendingListing()
  await openListing(page, id)

  const reason = review(page).getByLabel('Lý do')
  await reason.fill('   ')
  await review(page).getByRole('button', { name: 'Từ chối tin' }).click()
  await expect(main(page).locator('#reject-reason-error')).toHaveText(
    'Nhập lý do (1 đến 500 ký tự): người bán đọc lý do này để sửa tin.',
  )
  await expect(reason).toHaveValue('   ')
  await expect(reason).toHaveAttribute('aria-invalid', 'true')
  expect(await usedListingRow(id)).toMatchObject({ status: 'pending', reject_reason: null })

  await reason.fill('  Ảnh mờ, chụp lại bìa trước nhé.  ')
  await review(page).getByRole('button', { name: 'Từ chối tin' }).click()
  await expect(feedback(page)).toContainText('Đã từ chối tin.', { timeout: 15_000 })
  await expect(status(page)).toHaveText('Bị từ chối')
  await expect(main(page).getByTestId('used-listing-reject-reason')).toHaveText('Ảnh mờ, chụp lại bìa trước nhé.')
  await expect(main(page).getByTestId('listing-review-readonly')).toContainText('Tin đã bị từ chối')
  expect(await usedListingRow(id)).toMatchObject({ status: 'rejected', reject_reason: 'Ảnh mờ, chụp lại bìa trước nhé.' })
  expect(errors).toEqual([])
})

test('(c) Gỡ tin đang bán (hỏi lại tại chỗ, focus bàn phím) kèm lý do → rejected', async ({ page, admin }) => {
  test.setTimeout(90_000)
  const errors = collectErrors(page)
  const { id } = await createPendingListing()
  const adminClient = await signedInClient(admin)
  const approved = await adminClient.rpc('review_used_listing', {
    p_id: id,
    p_expected_status: 'pending',
    p_expected_updated_at: await usedListingUpdatedAt(id),
    p_approve: true,
  })
  expect(approved.error).toBeNull()

  await openListing(page, id)
  await expect(status(page)).toHaveText('Đang bán')
  await review(page).getByLabel('Lý do').fill('Tin vi phạm quy định đăng ảnh.')
  const open = review(page).getByRole('button', { name: 'Gỡ tin', exact: true })
  // Mở câu hỏi → focus "Không gỡ"; Enter ở "Không gỡ" → focus lại "Gỡ tin" (không gửi gì)
  await open.focus()
  await page.keyboard.press('Enter')
  const confirm = review(page).getByTestId('takedown-confirm')
  await expect(confirm).toContainText('Gỡ tin này khỏi Chợ sách cũ?')
  await expect(confirm.getByRole('button', { name: 'Không gỡ' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(confirm).toHaveCount(0)
  await expect(open).toBeFocused()
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved' })

  await open.click()
  await confirm.getByRole('button', { name: 'Gỡ tin', exact: true }).click()
  await expect(feedback(page)).toContainText('Đã gỡ tin.', { timeout: 15_000 })
  // Form vừa gửi bị gỡ khỏi trang → focus về khối kết quả
  await expect(feedback(page)).toBeFocused()
  await expect(status(page)).toHaveText('Bị từ chối')
  expect(await usedListingRow(id)).toMatchObject({ status: 'rejected', reject_reason: 'Tin vi phạm quy định đăng ảnh.' })
  expect(errors).toEqual([])
})

test('(d) người bán rút tin khi admin đang mở trang → Duyệt: LISTING_STATUS_CHANGED, trang hiện trạng thái mới', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const { id } = await createPendingListing()
  await openListing(page, id)
  await expect(status(page)).toHaveText('Chờ duyệt')

  const withdrawn = await sellerClient.rpc('withdraw_used_listing', { p_id: id })
  expect(withdrawn.error).toBeNull()
  await review(page).getByRole('button', { name: 'Duyệt tin' }).click()
  await expect(feedback(page)).toContainText(LISTING_CHANGED, { timeout: 15_000 })
  await expect(status(page)).toHaveText('Đã rút')
  await expect(main(page).getByTestId('listing-review-readonly')).toHaveText('Người bán đã rút tin: chỉ xem.')
  expect(await usedListingRow(id)).toMatchObject({ status: 'withdrawn', approved_at: null })
})

test('(h) người bán sửa giá tin chờ duyệt khi admin đang mở trang → Duyệt: câu riêng, vẫn chờ duyệt, trang hiện giá mới', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const errors = collectErrors(page)
  const { id, photos } = await createPendingListing()
  await openListing(page, id)
  await expect(status(page)).toHaveText('Chờ duyệt')
  await expect(main(page).getByTestId('used-listing-price')).toHaveText(vnd(LISTING_PRICE))

  // Tin vẫn chờ duyệt (expected_status khớp) nhưng nội dung đã khác bản admin đang xem: chỉ updated_at bắt được
  const newPrice = 65_000
  const edited = await sellerClient.rpc('update_used_listing', {
    p_id: id,
    p_condition: 'good',
    p_price: newPrice,
    p_description: 'Sách e2e admin',
    p_photos: photos,
  })
  expect(edited.error).toBeNull()
  await review(page).getByRole('button', { name: 'Duyệt tin' }).click()
  await expect(feedback(page)).toContainText(LISTING_CHANGED, { timeout: 15_000 })
  await expect(status(page)).toHaveText('Chờ duyệt')
  await expect(main(page).getByTestId('used-listing-price')).toHaveText(vnd(newPrice))
  expect(await usedListingRow(id)).toMatchObject({ status: 'pending', price: newPrice, approved_at: null })

  // Bản mới đã hiện (ô ẩn updated_at mới) → duyệt được
  await review(page).getByRole('button', { name: 'Duyệt tin' }).click()
  await expect(feedback(page)).toContainText('Đã duyệt tin', { timeout: 15_000 })
  await expect(status(page)).toHaveText('Đang bán')
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved', price: newPrice })
  expect(errors).toEqual([])
})

test('(i) tin bị xóa ở nơi khác khi admin đang mở trang → Duyệt: ITEM_DELETED, không báo "người bán vừa sửa"', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const errors = collectErrors(page)
  const { id } = await createPendingListing()
  await openListing(page, id)
  await expect(status(page)).toHaveText('Chờ duyệt')
  // next/image tải lười: ảnh chưa tải mà tin + ảnh đã bị xóa thì Storage trả 400 → "Failed to load resource" trong errors
  const photos = main(page).getByTestId('used-listing-photos').locator('img')
  await expect(photos).toHaveCount(1)
  await expect
    .poll(
      () =>
        photos.evaluateAll((images: HTMLImageElement[]) =>
          images.every((image) => image.complete && image.naturalWidth > 0),
        ),
      { timeout: 15_000 },
    )
    .toBe(true)

  // Service role xóa tin + ảnh (như xóa tay trong database): admin đọc được mọi tin nên 0 dòng = tin đã bị xóa
  await deleteUsedListingAsService(id)
  expect(await usedListingRow(id)).toBeNull()
  await review(page).getByRole('button', { name: 'Duyệt tin' }).click()
  await expect(feedback(page)).toContainText(ITEM_DELETED, { timeout: 15_000 })
  await expect(feedback(page)).not.toContainText(LISTING_CHANGED)
  expect(errors).toEqual([])
})

test('(e) ảnh của tin bị xóa ngoài policy → ô "Ảnh không còn"; Duyệt: LISTING_PHOTOS_MISSING, vẫn chờ duyệt', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const { id, photos } = await createPendingListing({ photos: 2 })
  const [missing] = photos
  if (!missing) throw new Error('Không có ảnh')
  await removeUsedPhotoAsService(missing)

  await openListing(page, id)
  await expect(main(page).getByTestId('used-listing-photos').getByRole('listitem')).toHaveCount(2)
  await expect(main(page).getByTestId('used-listing-photo-missing')).toHaveCount(1)
  await review(page).getByRole('button', { name: 'Duyệt tin' }).click()
  await expect(feedback(page)).toContainText(
    'Ảnh của tin không còn đủ. Hãy từ chối tin kèm lý do để người bán đăng lại ảnh.',
    { timeout: 15_000 },
  )
  await expect(status(page)).toHaveText('Chờ duyệt')
  expect(await usedListingRow(id)).toMatchObject({ status: 'pending', approved_at: null })
})

test('(f) giá gốc của sách hạ xuống dưới giá tin → Duyệt: câu riêng của admin về giá, vẫn chờ duyệt', async ({ page }) => {
  test.setTimeout(90_000)
  const { id } = await createPendingListing({ bookId: priceBook.id })
  const max = 60_000
  await setBookPrices(priceBook.id, { price: max, originalPrice: null })

  await openListing(page, id)
  await expect(main(page).getByTestId('used-listing-max-price')).toHaveText(vnd(max))
  await review(page).getByRole('button', { name: 'Duyệt tin' }).click()
  await expect(feedback(page)).toContainText(
    `Giá tin cao hơn giá gốc hiện tại của sách (tối đa ${vnd(max)}). Hãy từ chối tin kèm lý do.`,
    { timeout: 15_000 },
  )
  await expect(status(page)).toHaveText('Chờ duyệt')
  expect(await usedListingRow(id)).toMatchObject({ status: 'pending', price: LISTING_PRICE })
})

test('(g) khách và user thường mở /admin/sach-cu → về trang chủ', async ({ browser, baseURL }) => {
  test.setTimeout(60_000)
  const { id } = await createPendingListing()
  const guest = await browser.newContext({ baseURL, storageState: NO_SESSION })
  try {
    const guestPage = await guest.newPage()
    for (const path of ['/admin/sach-cu', `/admin/sach-cu/${id}`]) {
      await guestPage.goto(path)
      await expect(guestPage, path).toHaveURL(`${baseURL}/`)
    }
  } finally {
    await guest.close()
  }

  const context = await browser.newContext({ baseURL, storageState: NO_SESSION })
  try {
    const page = await context.newPage()
    await login(page, customer)
    for (const path of ['/admin/sach-cu', `/admin/sach-cu/${id}`]) {
      await page.goto(path)
      await expect(page, path).toHaveURL(`${baseURL}/`)
    }
  } finally {
    await context.close()
  }
})
