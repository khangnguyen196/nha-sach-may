import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import {
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  makeAdmin,
  ordersOf,
  seedAddress,
  sellerPayoutsOf,
  signedInClient,
  USED_PHOTO_BUCKET,
  usedListingRow,
  usedListingUpdatedAt,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import { fillLogin, login, NO_SESSION } from './auth'
import { vnd } from './cart'
import {
  collectErrors,
  collectErrorsAllow404,
  failServerActions,
  fillAddress,
  waitForHydration,
  waitForSettled,
} from './helpers'

// Chợ sách cũ P-C (docs/plans/cho-sach-cu.md): trang mua /cho-sach-cu/<id>/mua, placeUsedOrder, nhãn đơn sách cũ, hủy đơn
// → tin về đang bán, "Thêm địa chỉ" quay về trang mua, tiền người bán (khối "Đã bán"). Người bán + người mua + admin +
// sách test tạo riêng mỗi lần chạy (desktop-account / mobile-account song song không giẫm nhau), xóa ở afterAll.
//
// Quy tắc dữ liệu:
// - Sách test (createE2eBook) nằm trong danh mục con của gốc ẩn → tin không lên danh sách chợ (không giẫm (p5) của
//   used-market-public-account), trang tin / trang mua vẫn mở được bằng link trực tiếp.
// - Tin tạo bằng RPC của người bán, duyệt bằng RPC của admin: tin mới chưa nằm trong cache công khai nào. Trang tin
//   (cache theo id) chỉ mở SAU khi tin đã ở trạng thái cần kiểm, hoặc đổi trạng thái qua action của app (đặt / hủy đơn
//   qua giao diện: updateTag tag của tin).
// - Dọn ở afterAll: deleteE2eUsers (khoản trả của người bán → đơn của các user (cancelAndDeleteOrders) → tin kèm đơn
//   còn lại chứa tin → ảnh → user) → sách / danh mục test (trong finally).

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
/** User tạo trong từng ca (VD người mua chưa có địa chỉ), xóa cùng các user chung ở afterAll */
const caseUsers: E2eUser[] = []

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
  const users = [seller, buyer, admin, ...caseUsers].filter((user) => user !== undefined)
  // deleteE2eUsers đã dọn khoản trả → đơn (cancelAndDeleteOrders) → tin → ảnh → user. Sách / danh mục test dọn cả khi
  // bước đó lỗi; lỗi dọn sách khi đó chỉ ghi console để Playwright báo lỗi gốc
  let usersDeleted = false
  try {
    await deleteE2eUsers(users.map((user) => user.id))
    usersDeleted = true
  } finally {
    try {
      await cleanupE2eAdminData(slugs)
    } catch (error) {
      if (usersDeleted) throw error
      console.error('Dọn sách / danh mục test lỗi (sau khi xóa user lỗi)', error)
    }
  }
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

/**
 * Chờ form trang mua nhận tương tác thật: `waitForHydration` chỉ thấy React đã gắn props vào nút, `ready`
 * (useHydrated) có thể còn false thêm một lần render → nút khóa vì chưa hydrate chứ không vì lý do của ca.
 * Bộ đếm ghi chú đổi theo chữ gõ = handler đã chạy và React đã render lại sau hydrate (effect của useHydrated
 * chạy trước lần render đó), nên `ready` đã true. Trả ô về rỗng như lúc đầu.
 */
async function waitForBuyFormReady(page: Page) {
  const note = main(page).getByLabel('Ghi chú cho đơn hàng')
  await note.fill('x')
  await expect(main(page).getByText('1/500 ký tự', { exact: true })).toBeVisible()
  await note.fill('')
  await expect(main(page).getByText('0/500 ký tự', { exact: true })).toBeVisible()
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

/** Thêm địa chỉ từ link "Thêm địa chỉ" của trang mua tin `id` → lưu → về lại đúng trang mua kèm ?address=<id mới> */
async function addAddressFromBuyPage(page: Page, id: number, address: { name: string; street: string }) {
  await expect(page).toHaveURL(new RegExp(`/tai-khoan/dia-chi/moi\\?next=%2Fcho-sach-cu%2F${id}%2Fmua$`))
  // Hủy cũng về trang mua (không về sổ địa chỉ)
  await expect(main(page).getByRole('link', { name: 'Hủy', exact: true })).toHaveAttribute('href', buyPath(id))
  await fillAddress(page, {
    name: address.name,
    phone: '0912345678',
    province: 'Thành phố Hà Nội',
    ward: 'Phường Ba Đình',
    street: address.street,
  })
  await main(page).getByRole('button', { name: 'Lưu địa chỉ' }).click()
  await expect(page).toHaveURL(new RegExp(`/cho-sach-cu/${id}/mua\\?address=\\d+$`), { timeout: 20_000 })
  return Number(new URL(page.url()).searchParams.get('address'))
}

test('(m8) người mua chưa có địa chỉ: "Thêm địa chỉ" → lưu → về đúng trang mua, địa chỉ mới đã chọn → đặt được; thêm địa chỉ thứ hai → chọn địa chỉ mới (không phải mặc định)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const first = await createApprovedListing(47_000)
  const second = await createApprovedListing(52_000)
  const newBuyer = await createE2eUser('purchase-noaddr')
  caseUsers.push(newBuyer)
  await login(page, newBuyer)
  const errors = collectErrors(page)

  await page.goto(buyPath(first.id))
  await expect(main(page).getByText('Bạn chưa có địa chỉ giao hàng nào.', { exact: false })).toBeVisible()
  // Trước hydrate nút nào cũng khóa (SubmitButton ready): chờ ready thật để kiểm đúng lý do của ca (chưa có địa chỉ)
  await waitForHydration(page, 'main [data-testid="used-order-summary"] button[type="submit"]')
  await waitForBuyFormReady(page)
  await expect(placeButton(page)).toBeDisabled()
  await main(page).getByRole('link', { name: 'Thêm địa chỉ' }).click()
  await addAddressFromBuyPage(page, first.id, { name: 'Người Mua Mới', street: '1 Tràng Tiền' })
  // Next giữ trang mua vừa rời (cùng tin, khác ?address=) trong <main> ở dạng ẩn (Activity) → chỉ xét dòng đang hiển thị
  const option = main(page).getByTestId('checkout-address-option').filter({ visible: true })
  await expect(option).toHaveCount(1)
  await expect(option).toContainText('Người Mua Mới')
  await expect(option.getByRole('radio')).toBeChecked()
  await waitForHydration(page, 'main [data-testid="used-order-summary"] button[type="submit"]')
  await expect(placeButton(page)).toBeEnabled()
  await placeButton(page).click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  await expect(main(page).getByTestId('order-address')).toContainText('1 Tràng Tiền')
  expect(await usedListingRow(first.id)).toMatchObject({ status: 'sold' })

  // Đã có địa chỉ mặc định: thêm địa chỉ thứ hai từ trang mua → địa chỉ vừa thêm được chọn (không phải mặc định)
  await openBuyPage(page, second.id)
  await main(page).getByRole('link', { name: 'Thêm địa chỉ' }).click()
  const added = await addAddressFromBuyPage(page, second.id, { name: 'Người Nhận Thứ Hai', street: '9 Hàng Bài' })
  const options = main(page).getByTestId('checkout-address-option').filter({ visible: true })
  await expect(options).toHaveCount(2)
  const addedRadio = options.filter({ hasText: 'Người Nhận Thứ Hai' }).getByRole('radio')
  await expect(addedRadio).toBeChecked()
  await expect(addedRadio).toHaveAttribute('value', String(added))
  await expect(options.filter({ hasText: 'Người Mua Mới' }).getByRole('radio')).not.toBeChecked()
  await waitForHydration(page, 'main [data-testid="used-order-summary"] button[type="submit"]')
  await placeButton(page).click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  await expect(main(page).getByTestId('order-address')).toContainText('9 Hàng Bài')
  expect(await ordersOf(newBuyer.id)).toHaveLength(2)
  expect(errors).toEqual([])
})

/** Admin (phiên admin, RLS orders_admin_update) giao đơn theo đúng luồng trigger; COD tự thành đã thanh toán */
async function deliverAsAdmin(orderId: number) {
  for (const status of ['confirmed', 'shipping', 'delivered'] as const) {
    const { error } = await adminClient.from('orders').update({ status }).eq('id', orderId)
    if (error) throw new Error(`orders.update(${status}): ${error.message}`)
  }
}

test('(m9) người bán xem tiền: đơn COD đang giao → đã giao "Chờ trả" (giá − phí của RPC) → admin đánh dấu → "Đã trả"', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const price = 61_000
  const { id } = await createApprovedListing(price)
  // Phí sàn + số tiền người bán nhận do DB tính (used_listing_quote), test không tự tính
  const { data: quote, error: quoteError } = await sellerClient
    .rpc('used_listing_quote', { p_price: price })
    .single()
  if (quoteError) throw new Error(`used_listing_quote: ${quoteError.message}`)
  expect(quote.payout).toBe(price - quote.fee)
  const order = await placeAsBuyer(id, price)
  await login(page, seller)
  const errors = collectErrors(page)

  const row = main(page).locator(`[data-testid="sale-row"][data-listing-id="${id}"]`)
  await page.goto('/tai-khoan/sach-toi-ban')
  await expect(main(page).getByRole('heading', { name: 'Đã bán', level: 2 })).toBeVisible()
  await expect(row.getByTestId('sale-status')).toHaveText('Đang giao')
  await expect(row.getByTestId('sale-price')).toHaveText(vnd(price))
  await expect(row.getByTestId('sale-fee')).toHaveText(vnd(quote.fee))
  await expect(row.getByTestId('sale-amount')).toHaveText(vnd(quote.payout))
  // Đơn chưa giao chưa vào tổng; ghi chú demo
  await expect(main(page).getByTestId('my-sales-total-pending')).toHaveText(vnd(0))
  await expect(main(page).getByTestId('used-demo-note')).toHaveText('Tính năng demo, không có giao dịch thật.')

  await deliverAsAdmin(order.id)
  const [payout] = await sellerPayoutsOf(id)
  expect(payout).toMatchObject({ status: 'pending', fee: quote.fee, amount: quote.payout })

  await page.reload()
  await expect(row.getByTestId('sale-status')).toHaveText('Chờ trả')
  await expect(row.getByTestId('sale-amount')).toHaveText(vnd(quote.payout))
  await expect(row.getByTestId('sale-paid-at')).toHaveCount(0)
  await expect(main(page).getByTestId('my-sales-total-pending')).toHaveText(vnd(quote.payout))
  await expect(main(page).getByTestId('my-sales-total-paid')).toHaveText(vnd(0))

  const { error } = await adminClient.rpc('mark_payout_paid', { p_id: payout?.id ?? 0 })
  expect(error).toBeNull()
  await page.reload()
  await expect(row.getByTestId('sale-status')).toHaveText('Đã trả')
  await expect(row.getByTestId('sale-paid-at')).toContainText('Trả ngày')
  await expect(main(page).getByTestId('my-sales-total-pending')).toHaveText(vnd(0))
  await expect(main(page).getByTestId('my-sales-total-paid')).toHaveText(vnd(quote.payout))
  expect(errors).toEqual([])
})
