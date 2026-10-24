import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import {
  cancelAndDeleteOrders,
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  makeAdmin,
  ordersOf,
  seedAddress,
  signedInClient,
  USED_PHOTO_BUCKET,
  usedListingRow,
  usedListingUpdatedAt,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import { fillLogin, login, NO_SESSION } from './auth'
import { vnd } from './cart'
import { collectErrors, collectErrorsAllow404, failServerActions, waitForHydration, waitForSettled } from './helpers'

// Chợ sách cũ P-C (docs/plans/cho-sach-cu.md): trang mua /cho-sach-cu/<id>/mua, placeUsedOrder, nhãn đơn sách cũ, hủy đơn
// → tin về đang bán. Người bán + người mua + admin + sách test tạo riêng mỗi lần chạy (desktop-account / mobile-account
// song song không giẫm nhau), xóa ở afterAll.
//
// Quy tắc dữ liệu:
// - Sách test (createE2eBook) nằm trong danh mục con của gốc ẩn → tin không lên danh sách chợ (không giẫm (p5) của
//   used-market-public-account), trang tin / trang mua vẫn mở được bằng link trực tiếp.
// - Tin tạo bằng RPC của người bán, duyệt bằng RPC của admin: tin mới chưa nằm trong cache công khai nào. Trang tin
//   (cache theo id) chỉ mở SAU khi tin đã ở trạng thái cần kiểm, hoặc đổi trạng thái qua action của app (đặt / hủy đơn
//   qua giao diện: updateTag tag của tin).
// - Dọn ở afterAll: đơn của người mua (cancelAndDeleteOrders: hủy → tin về đang bán, xóa đơn) → deleteE2eUsers (khoản
//   trả → đơn còn lại chứa tin → tin → ảnh → user) → sách / danh mục test.

test.describe.configure({ mode: 'serial' })
test.use({ storageState: NO_SESSION })

type Client = Awaited<ReturnType<typeof signedInClient>>

const SHIPPING_FEE = 30_000
const BOOK_PRICE = 100_000
const ORIGINAL_PRICE = 120_000
const NETWORK_ERROR = 'Không kết nối được máy chủ. Bạn kiểm tra mạng rồi bấm lại nhé, thông tin đã nhập vẫn còn nguyên.'
const LISTING_CHANGED = 'Tin vừa được cập nhật (giá, tình trạng, mô tả hoặc ảnh). Bạn xem lại tin rồi đặt mua.'
const LISTING_UNAVAILABLE =
  'Cuốn sách cũ này vừa có người mua hoặc không còn bán. Bạn xem các bản cũ khác trong Chợ sách cũ nhé.'

let seller: E2eUser
let buyer: E2eUser
let admin: E2eUser
let sellerClient: Client
let buyerClient: Client
let adminClient: Client
let book: E2eAdminBook
let addressId: number
const slugs: string[] = []

test.beforeAll(async () => {
  test.setTimeout(60_000)
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  book = await createE2eBook({ categoryId: leaf.id, price: BOOK_PRICE, originalPrice: ORIGINAL_PRICE, stock: 10 })
  slugs.push(book.slug)
  ;[seller, buyer, admin] = await Promise.all([
    createE2eUser('purchase-seller'),
    createE2eUser('purchase-buyer'),
    createE2eUser('purchase-admin'),
  ])
  await makeAdmin(admin.id)
  ;[sellerClient, buyerClient, adminClient] = await Promise.all([
    signedInClient(seller),
    signedInClient(buyer),
    signedInClient(admin),
  ])
  addressId = await seedAddress(buyer.id)
})

test.afterAll(async () => {
  const users = [seller, buyer, admin].filter((user) => user !== undefined)
  await cancelAndDeleteOrders(users.map((user) => user.id))
  await deleteE2eUsers(users.map((user) => user.id))
  await cleanupE2eAdminData(slugs)
})

const main = (page: Page) => page.getByRole('main')
const buyPath = (id: number) => `/cho-sach-cu/${id}/mua`
const placeButton = (page: Page) => main(page).getByTestId('used-order-summary').getByRole('button', { name: 'Đặt mua' })

/** Tin đang bán của người bán (RPC theo phiên người bán + admin duyệt bằng RPC), ảnh WebP thật trong thư mục của họ */
async function createApprovedListing(price: number, { approve = true } = {}) {
  const path = `${seller.id}/${randomUUID()}.webp`
  const webp = await sharp({ create: { width: 60, height: 80, channels: 3, background: '#a85' } }).webp().toBuffer()
  const upload = await sellerClient.storage.from(USED_PHOTO_BUCKET).upload(path, webp, { contentType: 'image/webp' })
  if (upload.error) throw new Error(`upload: ${upload.error.message}`)
  const { data: id, error } = await sellerClient.rpc('create_used_listing', {
    p_book_id: book.id,
    p_condition: 'good',
    p_price: price,
    p_description: 'Sách e2e mua sách cũ',
    p_photos: [path],
  })
  if (error) throw new Error(`create_used_listing: ${error.message}`)
  if (approve) await approveAsAdmin(id)
  return { id, path }
}

/** Admin duyệt bằng RPC (như trang admin: trạng thái + updated_at của bản đang xem) */
async function approveAsAdmin(id: number) {
  const { error } = await adminClient.rpc('review_used_listing', {
    p_id: id,
    p_expected_status: 'pending',
    p_expected_updated_at: await usedListingUpdatedAt(id),
    p_approve: true,
  })
  if (error) throw new Error(`review_used_listing: ${error.message}`)
}

/** Người mua đặt bằng RPC (không qua giao diện: không updateTag) */
async function placeAsBuyer(id: number, price: number) {
  const { data, error } = await buyerClient.rpc('place_used_order', {
    p_listing_id: id,
    p_address_id: addressId,
    p_expected_updated_at: await usedListingUpdatedAt(id),
    p_idempotency_key: randomUUID(),
    p_expected_total: price + SHIPPING_FEE,
  })
  if (error) throw new Error(`place_used_order: ${error.message}`)
  return data
}

/** Mở trang mua đã đăng nhập, chờ nút đặt hydrate (bấm trước đó là POST thường, nút còn khóa) */
async function openBuyPage(page: Page, id: number) {
  await page.goto(buyPath(id))
  await expect(main(page).getByRole('heading', { name: 'Mua sách cũ', level: 1 })).toBeVisible()
  await waitForHydration(page, 'main [data-testid="used-order-summary"] button[type="submit"]')
  await expect(placeButton(page)).toBeEnabled()
}

const ordersCount = async () => (await ordersOf(buyer.id)).length

test('(m1) chưa đăng nhập bấm "Mua ngay" ở trang tin → đăng nhập → về đúng trang mua', async ({ page }) => {
  test.setTimeout(90_000)
  const price = 45_000
  const { id } = await createApprovedListing(price)
  const errors = collectErrors(page)

  await page.goto(`/cho-sach-cu/${id}`)
  const buy = main(page).getByRole('link', { name: 'Mua ngay' })
  await expect(buy).toBeVisible()
  await buy.click()
  await expect(page).toHaveURL(new RegExp(`/dang-nhap\\?next=%2Fcho-sach-cu%2F${id}%2Fmua$`))

  await fillLogin(page, buyer)
  await expect(page).toHaveURL(new RegExp(`/cho-sach-cu/${id}/mua$`), { timeout: 20_000 })
  await expect(main(page).getByRole('heading', { name: 'Mua sách cũ', level: 1 })).toBeVisible()
  await expect(main(page).getByTestId('used-order-total')).toHaveText(vnd(price + SHIPPING_FEE))
  await expect(placeButton(page)).toBeVisible()
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved' })
  expect(errors).toEqual([])
})

test('(m2) người mua COD: ghi chú demo, tổng = giá + 30.000 ₫, không bong bóng chat → đặt → tin đã bán, đơn có nhãn sách cũ', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const price = 55_000
  const { id } = await createApprovedListing(price)
  await login(page, buyer)
  const errors = collectErrors(page)

  // Trang tin (đang bán): có bong bóng chat (đối chứng; có thể đang ẩn vì nút Mua ngay nằm trong dải đáy, hoặc còn bản
  // sao ẩn của boundary → chỉ xét có trong DOM) và nút Mua ngay. Trang tin vào cache ở trạng thái đang bán
  await page.goto(`/cho-sach-cu/${id}`)
  await waitForSettled(page)
  await expect(page.getByTestId('chat-bubble').first()).toBeAttached()
  await main(page).getByRole('link', { name: 'Mua ngay' }).click()
  await expect(page).toHaveURL(new RegExp(`/cho-sach-cu/${id}/mua$`))
  await expect(main(page).getByRole('heading', { name: 'Mua sách cũ', level: 1 })).toBeVisible()
  await expect(page.getByTestId('chat-bubble')).toHaveCount(0)

  await openBuyPage(page, id)
  await expect(page.getByTestId('chat-bubble')).toHaveCount(0)
  const summary = main(page).getByTestId('used-order-summary')
  await expect(summary.getByTestId('used-demo-note')).toHaveText('Tính năng demo, không có giao dịch thật.')
  await expect(summary.getByTestId('used-order-title')).toHaveText(book.title)
  await expect(summary.getByTestId('used-order-condition')).toHaveText('Sách cũ · Tốt')
  await expect(summary.getByTestId('used-order-seller')).toHaveText(`Người bán: ${seller.fullName}`)
  await expect(summary.getByTestId('used-order-price')).toHaveText(vnd(price))
  await expect(summary.getByTestId('used-order-shipping')).toHaveText(vnd(SHIPPING_FEE))
  await expect(summary.getByTestId('used-order-total')).toHaveText(vnd(price + SHIPPING_FEE))
  await expect(main(page).getByTestId('checkout-address-option').getByRole('radio')).toBeChecked()
  await expect(main(page).getByRole('radio', { name: /Thanh toán khi nhận hàng/ })).toBeChecked()

  await placeButton(page).click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  const code = (await main(page).getByTestId('order-code').textContent())?.trim() ?? ''
  await expect(main(page).getByTestId('order-total')).toHaveText(vnd(price + SHIPPING_FEE))
  await expect(main(page).getByTestId('order-item-used')).toHaveText('Sách cũ · Tốt')
  expect(await usedListingRow(id)).toMatchObject({ status: 'sold' })

  // placeUsedOrder đã updateTag tag của tin → trang tin (đã cache lúc đang bán) hiện "Đã bán", không còn nút Mua
  await page.goto(`/cho-sach-cu/${id}`)
  await expect(main(page).getByTestId('market-listing-sold')).toHaveText('Đã bán')
  await expect(main(page).getByRole('link', { name: 'Mua ngay' })).toHaveCount(0)

  await page.goto('/tai-khoan/don-hang')
  const row = main(page).getByTestId('order-row').filter({ hasText: code })
  await expect(row).toHaveCount(1)
  await expect(row.getByTestId('order-item-used')).toHaveText('Sách cũ · Tốt')
  expect(errors).toEqual([])
})

test('(m3) người mua hủy đơn ở tài khoản → tin về đang bán, trang tin có lại nút "Mua ngay"', async ({ page }) => {
  test.setTimeout(90_000)
  const price = 40_000
  const { id } = await createApprovedListing(price)
  const order = await placeAsBuyer(id, price)
  await login(page, buyer)
  const errors = collectErrors(page)

  // Trang tin vào cache ở trạng thái đã bán (tin chưa từng mở trước khi đặt bằng RPC)
  await page.goto(`/cho-sach-cu/${id}`)
  await expect(main(page).getByTestId('market-listing-sold')).toBeVisible()
  await expect(main(page).getByRole('link', { name: 'Mua ngay' })).toHaveCount(0)

  await page.goto(`/tai-khoan/don-hang/${order.order_code}`)
  await expect(main(page).getByTestId('order-item-used')).toHaveText('Sách cũ · Tốt')
  await waitForHydration(page, 'main details form button[type="submit"]')
  await main(page).getByText('Hủy đơn hàng', { exact: true }).click()
  await main(page).getByLabel('Lý do hủy').fill('Đổi ý, mua bản khác')
  await main(page).getByRole('button', { name: 'Xác nhận hủy' }).click()
  await expect(main(page).getByTestId('cancel-done')).toHaveText('Đã hủy đơn hàng.')
  await expect(main(page).getByTestId('order-status').first()).toHaveText('Đã hủy')
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved' })

  // cancelOrder (expireOrderBooks) updateTag tag của tin → trang tin hết "Đã bán", có lại nút Mua ngay
  await page.goto(`/cho-sach-cu/${id}`)
  await expect(main(page).getByRole('link', { name: 'Mua ngay' })).toBeVisible()
  await expect(main(page).getByTestId('market-listing-sold')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('(m4) người bán mở trang mua tin của mình → câu LISTING_OWN, không có nút đặt', async ({ page }) => {
  test.setTimeout(60_000)
  const { id } = await createApprovedListing(50_000)
  await login(page, seller)
  const errors = collectErrors(page)

  await page.goto(buyPath(id))
  const unavailable = main(page).getByTestId('used-order-unavailable')
  await expect(unavailable).toContainText('Đây là tin của bạn')
  await expect(unavailable).toContainText('Đây là tin bạn đăng nên bạn không mua được.')
  await expect(unavailable.getByRole('link', { name: 'Xem Sách tôi bán' })).toBeVisible()
  await expect(main(page).getByRole('button', { name: 'Đặt mua' })).toHaveCount(0)
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved' })
  expect(errors).toEqual([])
})

test('(m5) tin bị sửa rồi duyệt lại cùng giá khi đang mở trang mua → LISTING_CHANGED, không tạo đơn → trang đã làm mới, đặt lại được', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const price = 65_000
  const { id, path } = await createApprovedListing(price)
  await login(page, buyer)
  const errors = collectErrors(page)
  await openBuyPage(page, id)
  await expect(main(page).getByTestId('used-order-description')).toHaveText('Sách e2e mua sách cũ')
  const before = await ordersCount()

  // Người bán sửa mô tả (giữ giá, tình trạng) → về chờ duyệt → admin duyệt lại: tổng tiền không đổi, updated_at đổi
  const edit = await sellerClient.rpc('update_used_listing', {
    p_id: id,
    p_condition: 'good',
    p_price: price,
    p_description: 'Gáy đã sờn, trang 12 có vết bút',
    p_photos: [path],
  })
  expect(edit.error).toBeNull()
  await approveAsAdmin(id)

  await main(page).getByLabel('Ghi chú cho đơn hàng').fill('Gọi trước khi giao')
  await placeButton(page).click()
  const alert = main(page).getByTestId('used-order-error')
  await expect(alert).toContainText(LISTING_CHANGED)
  await expect(alert).toBeFocused()
  expect(await ordersCount()).toBe(before)
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved' })
  // refresh(): trang hiện bản tin mới (ô ẩn nhận updated_at mới), ghi chú đã gõ còn nguyên
  await expect(main(page).getByTestId('used-order-description')).toHaveText('Gáy đã sờn, trang 12 có vết bút')
  await expect(main(page).getByTestId('used-order-total')).toHaveText(vnd(price + SHIPPING_FEE))
  await expect(main(page).getByLabel('Ghi chú cho đơn hàng')).toHaveValue('Gọi trước khi giao')

  await placeButton(page).click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  await expect(main(page).getByTestId('order-note')).toContainText('Gọi trước khi giao')
  expect(await ordersCount()).toBe(before + 1)
  expect(await usedListingRow(id)).toMatchObject({ status: 'sold' })
  expect(errors).toEqual([])
})

test('(m6) tin đã bán → LISTING_UNAVAILABLE + link về chợ; tin chờ duyệt / id không có / id sai dạng → 404 used-market', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const price = 35_000
  const { id: soldId } = await createApprovedListing(price)
  await placeAsBuyer(soldId, price)
  const { id: pendingId } = await createApprovedListing(30_000, { approve: false })
  await login(page, buyer)
  const errors = collectErrorsAllow404(page)

  const sold = await page.goto(buyPath(soldId))
  expect(sold?.status()).toBe(200)
  const unavailable = main(page).getByTestId('used-order-unavailable')
  await expect(unavailable).toContainText('Không mua được tin này')
  await expect(unavailable).toContainText(LISTING_UNAVAILABLE)
  await expect(unavailable.getByRole('link', { name: 'Về Chợ sách cũ' })).toBeVisible()
  await expect(main(page).getByRole('button', { name: 'Đặt mua' })).toHaveCount(0)

  for (const path of [buyPath(pendingId), buyPath(987_654_321), '/cho-sach-cu/abc/mua', `/en/used-books/${pendingId}/buy`]) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(404)
    await expect(main(page).getByTestId('not-found'), path).toHaveAttribute('data-kind', 'used-market')
  }
  await expect(main(page).getByRole('link', { name: 'Back to Used Books' })).toBeVisible()
  expect(await usedListingRow(pendingId)).toMatchObject({ status: 'pending' })
  expect(errors).toEqual([])
})

test('(m7) mất mạng lúc đặt → NETWORK_ERROR, ghi chú còn nguyên, không có đơn', async ({ page }) => {
  test.setTimeout(90_000)
  const { id } = await createApprovedListing(42_000)
  await login(page, buyer)
  await openBuyPage(page, id)
  const before = await ordersCount()

  const restore = await failServerActions(page, `**${buyPath(id)}`)
  try {
    await main(page).getByLabel('Ghi chú cho đơn hàng').fill('Giao giờ hành chính')
    await placeButton(page).click()
    const alert = main(page).getByTestId('used-order-error')
    await expect(alert).toContainText(NETWORK_ERROR)
    await expect(alert).toBeFocused()
    await expect(main(page).getByLabel('Ghi chú cho đơn hàng')).toHaveValue('Giao giờ hành chính')
    await expect(page).toHaveURL(new RegExp(`/cho-sach-cu/${id}/mua$`))
    await expect(placeButton(page)).toBeEnabled()
  } finally {
    await restore()
  }
  expect(await ordersCount()).toBe(before)
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved' })
})
