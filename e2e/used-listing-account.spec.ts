import { expect, test, type Page, type Route } from '@playwright/test'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import {
  anonClient,
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  downloadUsedPhoto,
  makeAdmin,
  removeUsedPhotosAsService,
  removeUsedPhotosOf,
  seedUsedPhotosAsService,
  signedInClient,
  USED_PHOTO_BUCKET,
  usedListingRow,
  usedListingsOf,
  usedPhotoExists,
  usedPhotosIn,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { vnd } from './cart'
import { collectErrors, collectErrorsAllow404 } from './helpers'

// Chợ sách cũ phần người bán (docs/plans/cho-sach-cu.md, P-B vòng 7, 8): đăng tin có ảnh qua UI, Sách tôi bán, sửa tin
// đã duyệt, rút tin (focus bằng bàn phím), bỏ ảnh khỏi form, ô chọn ảnh không quá 3 + tải lần lượt, trần 30 ảnh, dự
// phòng khi createImageBitmap lỗi. User (người bán, admin) + sách test tạo riêng mỗi lần chạy, xóa ở afterAll (ảnh trong
// thư mục của người bán xóa cùng user): desktop-account và mobile-account chạy song song không giẫm nhau.
//
// Ảnh mẫu e2e/fixtures/used-photo-exif.jpg (400×300, nửa trái đỏ / nửa phải xanh, EXIF orientation 6 + tọa độ GPS) tạo
// một lần bằng sharp có sẵn (chạy ở thư mục gốc repo, `node --input-type=module`):
//   const left = await sharp({ create: { width: 200, height: 300, channels: 3, background: '#ff0000' } }).png().toBuffer()
//   const halves = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#0000ff' } })
//     .composite([{ input: left, left: 0, top: 0 }]).png().toBuffer()
//   await sharp(halves).jpeg({ quality: 80 }).withMetadata({ orientation: 6 })
//     .withExifMerge({ IFD0: { Make: 'E2E' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '21/1 1/1 30/1',
//       GPSLongitudeRef: 'E', GPSLongitude: '105/1 51/1 0/1' } })
//     .toFile('e2e/fixtures/used-photo-exif.jpg')

test.describe.configure({ mode: 'serial' })
test.use({ storageState: NO_SESSION })

// Đường dẫn theo thư mục chạy Playwright (gốc repo), như e2e/fixtures/books.json ở chat.spec.ts
const PHOTO = 'e2e/fixtures/used-photo-exif.jpg'
const BOOK_PRICE = 80_000
const ORIGINAL_PRICE = 100_000
const LIST_URL = /\/tai-khoan\/sach-toi-ban$/

let seller: E2eUser
let admin: E2eUser
let book: E2eAdminBook
const slugs: string[] = []
/** Tin đăng ở ca (1), dùng tiếp ở (2), (5), (6) */
let listing: { id: number; photo: string } | undefined

test.beforeAll(async () => {
  test.setTimeout(60_000)
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  book = await createE2eBook({ categoryId: leaf.id, price: BOOK_PRICE, originalPrice: ORIGINAL_PRICE, stock: 10 })
  slugs.push(book.slug)
  ;[seller, admin] = await Promise.all([createE2eUser('used-ui'), createE2eUser('used-ui-admin')])
  await makeAdmin(admin.id)
})

test.afterAll(async () => {
  // deleteE2eUsers: tin của người bán → ảnh trong thư mục <user_id>/ (cả ảnh chưa gắn tin) → user; sách test sau cùng
  const users = [seller, admin].filter((user) => user !== undefined)
  await deleteE2eUsers(users.map((user) => user.id))
  await cleanupE2eAdminData(slugs)
})

const main = (page: Page) => page.getByRole('main')

function currentListing() {
  if (!listing) throw new Error('Ca (1) chưa đăng được tin')
  return listing
}

/** Mở form đăng tin, chờ hydrate (nút gửi khóa tới khi hydrate) */
async function openNewListing(page: Page) {
  await page.goto('/tai-khoan/sach-toi-ban/dang-tin')
  await expect(main(page).getByRole('button', { name: 'Đăng tin' })).toBeEnabled()
}

async function chooseBook(page: Page) {
  await main(page).getByLabel('Tìm sách trong cửa hàng').fill(book.title)
  await main(page).getByRole('button', { name: `Chọn sách “${book.title}”` }).click()
  await expect(main(page).getByTestId('listing-book')).toContainText(book.title)
  // Nút "Chọn" bị gỡ khỏi trang → focus "Đổi sách"
  await expect(main(page).getByRole('button', { name: 'Đổi sách' })).toBeFocused()
  await expect(main(page).getByText(`Tối đa ${vnd(ORIGINAL_PRICE)}`)).toBeVisible()
}

/** Chọn ảnh mẫu → client thu nhỏ → tải lên; trả đường dẫn ảnh trong kho (ô ẩn `photos`) */
async function addPhoto(page: Page, expectedCount: number) {
  await main(page).locator('input[type="file"]').setInputFiles(PHOTO)
  const paths = main(page).locator('input[type="hidden"][name="photos"]')
  await expect(paths).toHaveCount(expectedCount, { timeout: 20_000 })
  const path = await paths.nth(expectedCount - 1).getAttribute('value')
  if (!path) throw new Error('Không có đường dẫn ảnh')
  return path
}

const priceInput = (page: Page) => main(page).getByLabel('Giá bán (₫)')
const payout = (page: Page) => main(page).getByTestId('listing-payout')
const payoutText = (payout: number, fee: number) => `Bạn nhận được ${vnd(payout)} (phí sàn ${vnd(fee)}).`
const row = (page: Page, id: number) => main(page).locator(`[data-testid="listing-row"][data-listing-id="${id}"]`)

async function pixel(webp: Buffer, x: number, y: number) {
  const { data, info } = await sharp(webp).raw().toBuffer({ resolveWithObject: true })
  const at = (y * info.width + x) * info.channels
  return { r: data[at] ?? 0, g: data[at + 1] ?? 0, b: data[at + 2] ?? 0 }
}

/** Ảnh trong kho: WebP, không EXIF / XMP, đã xoay theo orientation 6 của ảnh mẫu → ảnh dọc, nửa đỏ trên, xanh dưới */
async function expectStoredPortrait(path: string) {
  const stored = await downloadUsedPhoto(path)
  const meta = await sharp(stored).metadata()
  expect(meta.format).toBe('webp')
  expect(meta.exif).toBeUndefined()
  expect(meta.xmp).toBeUndefined()
  expect(meta.height).toBeGreaterThan(meta.width ?? Infinity)
  const top = await pixel(stored, Math.floor((meta.width ?? 0) / 2), 5)
  const bottom = await pixel(stored, Math.floor((meta.width ?? 0) / 2), (meta.height ?? 0) - 5)
  expect(top.r > 200 && top.b < 60, JSON.stringify(top)).toBe(true)
  expect(bottom.b > 200 && bottom.r < 60, JSON.stringify(bottom)).toBe(true)
}

const fileInput = (page: Page) => main(page).locator('input[type="file"]')
const photoPaths = (page: Page) => main(page).locator('input[type="hidden"][name="photos"]')

/** Ảnh mẫu dưới dạng buffer, mỗi file một tên (chọn nhiều ảnh trong một lượt) */
function photoFiles(...names: string[]) {
  const buffer = readFileSync(PHOTO)
  return names.map((name) => ({ name, mimeType: 'image/jpeg', buffer }))
}

test('(1)(3) đăng tin có ảnh → Chờ duyệt; "bạn nhận được" từ RPC; ảnh trong kho là WebP không EXIF, đã xoay', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const errors = collectErrors(page)
  await login(page, seller)
  await page.goto('/tai-khoan')
  await main(page).getByRole('link', { name: /Sách tôi bán/ }).click()
  await expect(page).toHaveURL(LIST_URL)
  await expect(main(page).getByText('Bạn chưa đăng bán cuốn sách nào')).toBeVisible()

  await openNewListing(page)
  await expect(main(page).getByTestId('used-demo-note')).toHaveText('Tính năng demo, không có giao dịch thật.')
  await chooseBook(page)
  await main(page).getByRole('radio', { name: /^Tốt/ }).check()
  // (3) Phí sàn 10% làm tròn nghìn: 25.000 → phí 3.000, nhận 22.000 (số của used_listing_quote)
  await priceInput(page).fill('25000')
  await expect(payout(page)).toHaveText(payoutText(22_000, 3_000))
  await main(page).getByLabel('Mô tả (không bắt buộc)').fill('Gáy hơi sờn, ruột sạch.')
  const photo = await addPhoto(page, 1)
  await expect(main(page).getByRole('img', { name: 'Ảnh 1 của tin' })).toBeVisible()

  await main(page).getByRole('button', { name: 'Đăng tin' }).click()
  await expect(page).toHaveURL(LIST_URL, { timeout: 20_000 })

  const [created] = await usedListingsOf(seller.id)
  expect(created).toMatchObject({
    status: 'pending',
    price: 25_000,
    fee: 3_000,
    condition: 'good',
    description: 'Gáy hơi sờn, ruột sạch.',
    photos: [photo],
  })
  if (!created) return
  listing = { id: created.id, photo }
  const item = row(page, created.id)
  await expect(item.getByTestId('listing-status')).toHaveText('Chờ duyệt')
  await expect(item).toContainText(book.title)
  await expect(item.getByTestId('listing-price')).toHaveText(vnd(25_000))
  await expect(item).toContainText(`Bạn nhận ${vnd(22_000)}`)

  // Ảnh trong kho: WebP, không EXIF (GPS), đã xoay theo orientation 6 → ảnh dọc, nửa đỏ ở trên.
  // Qua UI thì ảnh tới server là JPEG do canvas của trình duyệt vẽ lại: ĐÃ xoay (createImageBitmap 'from-image') và ĐÃ
  // mất EXIF / GPS trước khi gửi. Ca này canh luồng client + kho; phần server tự xoay theo EXIF và bỏ EXIF / GPS (ảnh
  // không qua canvas, VD gọi thẳng action) do Vitest src/features/used/photos.test.ts canh.
  await expectStoredPortrait(photo)
  expect(errors).toEqual([])
})

test('(2) tin chờ duyệt không công khai: anon đọc REST 0 dòng, ký link ảnh bằng anon lỗi', async () => {
  const { id, photo } = currentListing()
  const anon = anonClient()
  const { data, error } = await anon.from('used_listings').select('id').eq('id', id)
  expect(error).toBeNull()
  expect(data).toEqual([])
  const signed = await anon.storage.from(USED_PHOTO_BUCKET).createSignedUrl(photo, 60)
  expect(signed.error).not.toBeNull()
  expect(signed.data).toBeNull()
})

test('(4) giá vượt giá gốc → lỗi dưới ô giá, chữ đã gõ còn nguyên', async ({ page }) => {
  test.setTimeout(90_000)
  // Ảnh tải lên ở ca này không gắn tin nào → xóa đúng ảnh đó ở finally (ca (8) kiểm thư mục người bán rỗng để bắt ảnh
  // mồ côi, nên không được để lại)
  const uploaded: string[] = []
  try {
    await login(page, seller)
    await openNewListing(page)
    await chooseBook(page)
    await main(page).getByRole('radio', { name: /^Khá/ }).check()
    await priceInput(page).fill('150000')
    await main(page).getByLabel('Mô tả (không bắt buộc)').fill('Còn tốt')
    uploaded.push(await addPhoto(page, 1))
    await main(page).getByRole('button', { name: 'Đăng tin' }).click()

    await expect(main(page).locator('#field-price-error')).toHaveText(
      'Giá bán phải lớn hơn 0 và không cao hơn giá gốc của sách.',
    )
    await expect(page).toHaveURL(/\/tai-khoan\/sach-toi-ban\/dang-tin$/)
    await expect(priceInput(page)).toHaveValue('150000')
    await expect(priceInput(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(main(page).getByLabel('Mô tả (không bắt buộc)')).toHaveValue('Còn tốt')
    await expect(main(page).getByRole('radio', { name: /^Khá/ })).toBeChecked()
    await expect(main(page).locator('input[type="hidden"][name="photos"]')).toHaveCount(1)
    // Không tạo thêm tin
    expect(await usedListingsOf(seller.id)).toHaveLength(1)
  } finally {
    await removeUsedPhotosAsService(uploaded)
  }
})

test('(5) tin đã duyệt sửa giá qua UI → về Chờ duyệt', async ({ page }) => {
  test.setTimeout(90_000)
  const { id, photo } = currentListing()
  const adminClient = await signedInClient(admin)
  const review = await adminClient.rpc('review_used_listing', {
    p_id: id,
    p_expected_status: 'pending',
    p_approve: true,
  })
  expect(review.error).toBeNull()
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved' })

  const errors = collectErrors(page)
  await login(page, seller)
  await page.goto('/tai-khoan/sach-toi-ban')
  await expect(row(page, id).getByTestId('listing-status')).toHaveText('Đang bán')
  await row(page, id).getByRole('link', { name: `Sửa tin “${book.title}”` }).click()
  await expect(page).toHaveURL(new RegExp(`/tai-khoan/sach-toi-ban/${id}$`))
  await expect(main(page).getByTestId('listing-edit-notice')).toContainText('tin về Chờ duyệt')
  const save = main(page).getByRole('button', { name: 'Lưu và gửi duyệt' })
  await expect(save).toBeEnabled()
  await expect(priceInput(page)).toHaveValue('25000')
  await expect(payout(page)).toHaveText(payoutText(22_000, 3_000))
  await expect(main(page).getByRole('img', { name: 'Ảnh 1 của tin' })).toBeVisible()

  await priceInput(page).fill('30000')
  await expect(payout(page)).toHaveText(payoutText(27_000, 3_000))
  await save.click()
  await expect(page).toHaveURL(LIST_URL, { timeout: 20_000 })
  await expect(row(page, id).getByTestId('listing-status')).toHaveText('Chờ duyệt')
  await expect(row(page, id).getByTestId('listing-price')).toHaveText(vnd(30_000))
  expect(await usedListingRow(id)).toMatchObject({ status: 'pending', price: 30_000, fee: 3_000 })
  // Ảnh giữ nguyên trong tin → không bị xóa khi lưu
  expect(await usedPhotoExists(photo)).toBe(true)
  expect(errors).toEqual([])
})

test('(6) rút tin → Đã rút, ảnh của tin không còn trong kho', async ({ page }) => {
  test.setTimeout(90_000)
  const { id, photo } = currentListing()
  expect(await usedPhotoExists(photo)).toBe(true)
  await login(page, seller)
  await page.goto('/tai-khoan/sach-toi-ban')
  const item = row(page, id)
  const open = item.getByRole('button', { name: 'Rút tin' })
  await expect(open).toBeEnabled()
  // Focus (WCAG 2.4.3) bằng bàn phím: mở câu hỏi → focus "Không rút"; Enter ở "Không rút" → focus lại "Rút tin"
  await open.focus()
  await page.keyboard.press('Enter')
  const confirm = item.getByTestId('withdraw-confirm')
  await expect(confirm).toContainText('Rút tin này?')
  await expect(confirm.getByRole('button', { name: 'Không rút' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(confirm).toHaveCount(0)
  await expect(open).toBeFocused()

  await open.click()
  await expect(confirm.getByRole('button', { name: 'Không rút' })).toBeFocused()
  await confirm.getByRole('button', { name: 'Rút tin' }).click()

  await expect(item.getByTestId('listing-status')).toHaveText('Đã rút', { timeout: 15_000 })
  // Nút Rút tin bị gỡ khỏi trang: focus về tên sách + trạng thái của mục tin, không rơi về body
  await expect(item.getByTestId('listing-heading')).toBeFocused()
  await expect(item.getByRole('link', { name: /^Sửa tin/ })).toHaveCount(0)
  await expect(item.getByRole('button', { name: 'Rút tin' })).toHaveCount(0)
  expect(await usedListingRow(id)).toMatchObject({ status: 'withdrawn' })
  expect(await usedPhotoExists(photo)).toBe(false)
})

test('(7) bỏ ảnh khỏi form trước khi gửi → ảnh bị xóa khỏi kho', async ({ page }) => {
  test.setTimeout(90_000)
  await login(page, seller)
  await openNewListing(page)
  const photo = await addPhoto(page, 1)
  expect(await usedPhotoExists(photo)).toBe(true)
  await main(page).getByRole('button', { name: 'Bỏ ảnh 1' }).click()
  await expect(main(page).locator('input[type="hidden"][name="photos"]')).toHaveCount(0)
  // Nút vừa bấm bị gỡ khỏi trang → focus về ô chọn ảnh
  await expect(fileInput(page)).toBeFocused()
  await expect.poll(() => usedPhotoExists(photo), { timeout: 15_000 }).toBe(false)
})

test('(8) chọn 2 ảnh, lúc ảnh đầu đang tải chọn thêm 2 → đúng 3 ô, 3 ảnh trong kho, tải lần lượt', async ({ page }) => {
  test.setTimeout(120_000)
  await expect.poll(() => usedPhotosIn(seller.id), { timeout: 15_000 }).toEqual([])
  // Giữ request tải ảnh (Server Action gửi FormData = multipart) tới khi test cho đi: ảnh đầu chắc chắn còn đang tải lúc
  // chọn lượt hai. Request khác (tìm sách, tính phí, tải trang) đi bình thường.
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let held = 0
  const holdUploads = async (route: Route) => {
    const request = route.request()
    const multipart = (request.headers()['content-type'] ?? '').startsWith('multipart/form-data')
    if (request.method() !== 'POST' || !request.headers()['next-action'] || !multipart) return route.continue()
    held++
    await gate
    await route.continue()
  }
  const url = '**/tai-khoan/sach-toi-ban/dang-tin'
  await page.route(url, holdUploads)
  try {
    await login(page, seller)
    await openNewListing(page)
    await fileInput(page).setInputFiles(photoFiles('a.jpg', 'b.jpg'))
    const slots = main(page).getByTestId('listing-photos').getByRole('listitem')
    await expect(slots).toHaveCount(2)
    await expect.poll(() => held, { timeout: 15_000 }).toBe(1)

    // Còn 1 chỗ: lượt hai chỉ nhận 1 ảnh, ô chọn ảnh ẩn ngay (tính cả ô đang tải)
    await fileInput(page).setInputFiles(photoFiles('c.jpg', 'd.jpg'))
    await expect(slots).toHaveCount(3)
    await expect(fileInput(page)).toHaveCount(0)
    // Ô chọn ảnh bị gỡ khi đủ 3 ô → focus về nút "Bỏ ảnh" cuối, không rơi về body
    await expect(main(page).getByRole('button', { name: 'Bỏ ảnh 3' })).toBeFocused()
    await expect(main(page).getByRole('status').filter({ hasText: 'Đang tải ảnh…' })).toHaveCount(3)
    // Lúc ảnh đầu còn bị giữ chưa có request thứ hai. Kiểm này KHÔNG tự đỏ khi bỏ hàng đợi tải của client: Next gửi
    // Server Action tuần tự (action sau chờ action trước xong) nên request thứ hai cũng chưa đi. Thứ bắt lỗi hàng đợi /
    // giữ chỗ là đúng 3 ô + 3 ảnh trong kho khớp 3 ô ở dưới.
    expect(held).toBe(1)

    release()
    await expect(photoPaths(page)).toHaveCount(3, { timeout: 60_000 })
    await expect(slots).toHaveCount(3)
    expect(held).toBe(3)
    const shown = await photoPaths(page).evaluateAll((inputs) => inputs.map((input) => input.getAttribute('value')))
    expect((await usedPhotosIn(seller.id)).sort()).toEqual(shown.sort())
  } finally {
    release()
    await page.unroute(url, holdUploads)
    await removeUsedPhotosOf(seller.id)
  }
})

test('(9) đã có 30 ảnh trong kho → chọn ảnh: câu LISTING_PHOTO_LIMIT, không thêm ảnh', async ({ page }) => {
  test.setTimeout(90_000)
  const webp = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#777' } }).webp().toBuffer()
  // Service role bỏ qua policy; policy đếm ảnh theo thư mục <uid>/ (ảnh chưa gắn tin cũng tính)
  const seeded = await seedUsedPhotosAsService(seller.id, 30, webp)
  try {
    await login(page, seller)
    await openNewListing(page)
    await fileInput(page).setInputFiles(PHOTO)
    await expect(main(page).getByTestId('listing-photos-error')).toHaveText(
      'Bạn đã có 30 ảnh sách cũ nên chưa tải thêm được. Số này tính cả ảnh của tin chờ duyệt, đang bán, bị từ chối và ảnh đã tải mà chưa đăng; ảnh đã tải quá 24 giờ mà chưa đăng được dọn khi bạn mở trang đăng hoặc sửa tin. Bạn bỏ bớt ảnh khỏi tin bị từ chối hoặc rút tin không còn muốn bán rồi thử lại nhé.',
      { timeout: 20_000 },
    )
    await expect(main(page).getByTestId('listing-photos').getByRole('listitem')).toHaveCount(0)
    await expect(photoPaths(page)).toHaveCount(0)
    expect((await usedPhotosIn(seller.id)).sort()).toEqual([...seeded].sort())
  } finally {
    await removeUsedPhotosOf(seller.id)
  }
})

/** Khóa sessionStorage chọn kiểu lỗi của createImageBitmap giả cho các lần tải trang sau trong cùng tab */
const BITMAP_MODE_KEY = 'e2e-bitmap-mode'

/** Kiểu lỗi + số lần gọi createImageBitmap giả (<html data-e2e-bitmap="throw:1">): chắc chắn đúng bản giả được dùng */
const fakeBitmapCalls = (page: Page) => page.evaluate(() => document.documentElement.dataset.e2eBitmap ?? '')

test('(10) createImageBitmap lỗi (trình duyệt cũ) → dự phòng <img>: ảnh EXIF vẫn tải được, đã xoay dọc', async ({
  page,
}) => {
  test.setTimeout(120_000)
  // MỘT init script (thứ tự chạy của nhiều addInitScript không được bảo đảm), chọn kiểu lỗi theo sessionStorage lúc tải
  // trang: 'throw' (mặc định) ném TypeError ngay khi gọi; 'reject' như trình duyệt thật, trả Promise bị từ chối
  await page.addInitScript((key) => {
    let mode = 'throw'
    try {
      if (sessionStorage.getItem(key) === 'reject') mode = 'reject'
    } catch {
      // about:blank không có sessionStorage: giữ mặc định
    }
    let calls = 0
    window.createImageBitmap = () => {
      calls++
      document.documentElement.dataset.e2eBitmap = `${mode}:${calls}`
      const error = new TypeError("The provided value 'from-image' is not a valid enum value of type ImageOrientation.")
      if (mode === 'throw') throw error
      return Promise.reject(error)
    }
  }, BITMAP_MODE_KEY)
  try {
    // Lượt 1: ném TypeError ngay khi gọi
    await login(page, seller)
    await openNewListing(page)
    const thrown = await addPhoto(page, 1)
    await expect(main(page).getByTestId('listing-photos-error')).toHaveCount(0)
    expect(await fakeBitmapCalls(page)).toBe('throw:1')
    await expectStoredPortrait(thrown)

    // Lượt 2: Promise bị từ chối (đặt chế độ trước khi tải lại trang đăng tin)
    await page.evaluate((key) => sessionStorage.setItem(key, 'reject'), BITMAP_MODE_KEY)
    await openNewListing(page)
    const rejected = await addPhoto(page, 1)
    await expect(main(page).getByTestId('listing-photos-error')).toHaveCount(0)
    expect(await fakeBitmapCalls(page)).toBe('reject:1')
    await expectStoredPortrait(rejected)
  } finally {
    await removeUsedPhotosOf(seller.id)
  }
})

test('trang sửa tin không có / của người khác → 404 thật kiểu used-listing', async ({ page }) => {
  const errors = collectErrorsAllow404(page)
  await login(page, admin)
  // Tin của người bán (đã rút ở ca 6) mở bằng tài khoản khác (kể cả admin) → cùng một trang 404
  const { id } = currentListing()
  for (const path of [`/tai-khoan/sach-toi-ban/${id}`, '/tai-khoan/sach-toi-ban/987654321', '/en/account/my-listings/abc']) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(404)
    await expect(main(page).getByTestId('not-found')).toHaveAttribute('data-kind', 'used-listing')
  }
  expect(errors).toEqual([])
})
