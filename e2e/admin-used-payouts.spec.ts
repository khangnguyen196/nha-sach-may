import { expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import {
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  deliverOrder,
  seedAddress,
  sellerPayoutsOf,
  signedInClient,
  USED_PHOTO_BUCKET,
  usedListingUpdatedAt,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import { adminTest as test, main } from './admin'
import { readAdminCredentials } from './auth'
import { vnd } from './cart'
import { collectErrors, waitForHydration } from './helpers'

// Trang khoản trả người bán /admin/tra-nguoi-ban (docs/plans/cho-sach-cu.md, P-C vòng 16): sổ tiền MÔ PHỎNG, "Đã trả"
// chỉ ghi trạng thái. Người bán + người mua + sách e2e-admin tạo riêng mỗi lần chạy; mỗi ca tự có một tin → đơn COD
// (RPC theo phiên người mua) → giao (service role, đúng luồng trigger; COD tự đã thanh toán → trigger ghi khoản chờ trả).
// Dọn ở afterAll: deleteE2eUsers (khoản trả của người bán → đơn → tin → ảnh → user), rồi cleanupE2eAdminData đúng slug
// của spec trong finally (sách sau tin: book_id restrict).

test.describe.configure({ mode: 'serial' })

type Client = Awaited<ReturnType<typeof signedInClient>>

const SHIPPING_FEE = 30_000
/** Câu riêng của admin cho PAYOUT_STATUS_CHANGED (admin.payouts.payoutChanged) */
const PAYOUT_CHANGED =
  'Khoản này vừa được cập nhật ở nơi khác (đã trả, hoặc đơn đổi trạng thái thanh toán). Trang đã hiện trạng thái mới.'

let seller: E2eUser
let buyer: E2eUser
let sellerClient: Client
let buyerClient: Client
let adminClient: Client
let book: E2eAdminBook
let addressId: number
const slugs: string[] = []

test.beforeAll(async ({}, testInfo) => {
  test.setTimeout(60_000)
  const admin = readAdminCredentials()[testInfo.project.name]
  if (!admin) throw new Error(`Không có admin e2e cho project ${testInfo.project.name}`)
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  book = await createE2eBook({ categoryId: leaf.id, price: 90_000, originalPrice: 110_000 })
  slugs.push(book.slug)
  ;[seller, buyer] = await Promise.all([createE2eUser('payout-seller'), createE2eUser('payout-buyer')])
  ;[sellerClient, buyerClient, adminClient] = await Promise.all([
    signedInClient(seller),
    signedInClient(buyer),
    signedInClient(admin),
  ])
  addressId = await seedAddress(buyer.id)
})

test.afterAll(async () => {
  let usersDeleted = false
  try {
    await deleteE2eUsers([seller, buyer].filter((user) => user !== undefined).map((user) => user.id))
    usersDeleted = true
  } finally {
    try {
      await cleanupE2eAdminData(slugs)
    } catch (error) {
      // Xóa user lỗi thì lỗi đó là lỗi gốc; lỗi dọn sách (thường do tin còn sót) chỉ ghi console
      if (usersDeleted) throw error
      console.error('Dọn sách / danh mục test lỗi (sau khi xóa user lỗi)', error)
    }
  }
})

/**
 * Tin của người bán (ảnh thật, duyệt bằng RPC của admin) → người mua đặt COD bằng RPC → giao đơn → khoản chờ trả.
 * Trả id tin, mã đơn, khoản (đọc bằng service role).
 */
async function createPendingPayout(price: number) {
  const path = `${seller.id}/${randomUUID()}.webp`
  const webp = await sharp({ create: { width: 60, height: 80, channels: 3, background: '#58a' } }).webp().toBuffer()
  const upload = await sellerClient.storage.from(USED_PHOTO_BUCKET).upload(path, webp, { contentType: 'image/webp' })
  if (upload.error) throw new Error(`upload: ${upload.error.message}`)
  const { data: id, error } = await sellerClient.rpc('create_used_listing', {
    p_book_id: book.id,
    p_condition: 'good',
    p_price: price,
    p_description: 'Sách e2e trả người bán',
    p_photos: [path],
  })
  if (error) throw new Error(`create_used_listing: ${error.message}`)
  const review = await adminClient.rpc('review_used_listing', {
    p_id: id,
    p_expected_status: 'pending',
    p_expected_updated_at: await usedListingUpdatedAt(id),
    p_approve: true,
  })
  if (review.error) throw new Error(`review_used_listing: ${review.error.message}`)
  const order = await buyerClient.rpc('place_used_order', {
    p_listing_id: id,
    p_address_id: addressId,
    p_expected_updated_at: await usedListingUpdatedAt(id),
    p_idempotency_key: randomUUID(),
    p_expected_total: price + SHIPPING_FEE,
  })
  if (order.error) throw new Error(`place_used_order: ${order.error.message}`)
  await deliverOrder(order.data.id)
  const [payout] = await sellerPayoutsOf(id)
  if (!payout) throw new Error(`Không có khoản trả cho tin ${id}`)
  expect(payout).toMatchObject({ status: 'pending', price, amount: price - payout.fee })
  return { listingId: id, orderCode: order.data.order_code, payout }
}

const row = (page: Page, id: number) => main(page).locator(`[data-testid="admin-payout"][data-payout-id="${id}"]`)
const filter = (page: Page, name: string) =>
  main(page).getByRole('navigation', { name: 'Lọc khoản trả' }).getByRole('link', { name, exact: true })
/** Dòng đếm của danh sách: nội dung đã stream xong (kiểm "không có dòng" sau đó mới có nghĩa) */
const listCount = (page: Page) => main(page).getByRole('status').filter({ hasText: /^\d+ khoản$/ })
const markButton = (page: Page, id: number) => row(page, id).getByRole('button', { name: /Đánh dấu đã trả/ })

/** Mở danh sách (tất cả), chờ nút "Đã trả" của khoản `id` hydrate (nút gửi khóa tới khi hydrate) */
async function openPayouts(page: Page, id: number) {
  await page.goto('/admin/tra-nguoi-ban')
  await expect(main(page).getByRole('heading', { name: 'Trả người bán', level: 1 })).toBeVisible()
  await waitForHydration(page, `main [data-payout-id="${id}"] button[type="submit"]`)
  await expect(markButton(page, id)).toBeEnabled()
}

test('(a) khoản chờ trả hiện ở /admin/tra-nguoi-ban (lọc Chờ trả), bấm "Đã trả" → dòng sang Đã trả, nút biến mất', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const { listingId, orderCode, payout } = await createPendingPayout(64_000)
  const errors = collectErrors(page)

  // Mục nav mới → trang; ghi chú mô phỏng
  await page.goto('/admin')
  await page.getByRole('navigation', { name: 'Khu quản trị' }).getByRole('link', { name: 'Trả người bán' }).click()
  await expect(page).toHaveURL(/\/admin\/tra-nguoi-ban$/)
  await expect(main(page).getByTestId('payouts-demo-note')).toContainText('không chuyển tiền thật')
  const item = row(page, payout.id)
  await expect(item).toContainText(book.title)
  await expect(item).toContainText(seller.fullName)
  await expect(item.getByRole('link', { name: orderCode })).toHaveAttribute('href', `/admin/don-hang/${orderCode}`)
  await expect(item.getByTestId('admin-payout-amount')).toHaveText(vnd(payout.amount))
  await expect(item.getByTestId('admin-payout-order-status')).toHaveText('Đã giao · Đã thanh toán')
  await expect(item.getByTestId('admin-payout-status')).toHaveText('Chờ trả')
  await expect(item.getByTestId('admin-payout-paid-at')).toHaveText('')

  // Lọc Chờ trả (tham số URL tiếng Việt)
  await filter(page, 'Chờ trả').click()
  await expect(page).toHaveURL(/\/admin\/tra-nguoi-ban\?trang-thai=cho-tra$/)
  await expect(filter(page, 'Chờ trả')).toHaveAttribute('aria-current', 'true')
  await expect(row(page, payout.id).getByTestId('admin-payout-status')).toHaveText('Chờ trả')
  await page.goto('/admin/tra-nguoi-ban?trang-thai=da-tra')
  await expect(listCount(page)).toBeVisible()
  await expect(row(page, payout.id)).toHaveCount(0)

  // Bấm ở danh sách tất cả: dòng còn sau refresh() → thấy trạng thái mới tại chỗ
  await openPayouts(page, payout.id)
  await markButton(page, payout.id).click()
  await expect(row(page, payout.id).getByRole('status')).toHaveText('Đã đánh dấu đã trả.', { timeout: 15_000 })
  await expect(row(page, payout.id).getByTestId('admin-payout-status')).toHaveText('Đã trả')
  await expect(row(page, payout.id).getByTestId('admin-payout-paid-at')).not.toHaveText('')
  await expect(markButton(page, payout.id)).toHaveCount(0)
  expect(await sellerPayoutsOf(listingId)).toEqual([expect.objectContaining({ id: payout.id, status: 'paid' })])

  await page.goto('/admin/tra-nguoi-ban?trang-thai=cho-tra')
  await expect(listCount(page)).toBeVisible()
  await expect(row(page, payout.id)).toHaveCount(0)
  await page.goto('/admin/tra-nguoi-ban?trang-thai=da-tra')
  await expect(row(page, payout.id).getByTestId('admin-payout-status')).toHaveText('Đã trả')
  await expect(markButton(page, payout.id)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('(b) hai tab: khoản đã được đánh dấu ở nơi khác → bấm ở trang cũ ra câu PAYOUT_STATUS_CHANGED, trang làm mới', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const { listingId, payout } = await createPendingPayout(58_000)
  const errors = collectErrors(page)
  await openPayouts(page, payout.id)

  // "Tab khác" đánh dấu trước bằng RPC (cùng quyền admin)
  const { error } = await adminClient.rpc('mark_payout_paid', { p_id: payout.id })
  expect(error).toBeNull()

  await markButton(page, payout.id).click()
  const alert = row(page, payout.id).getByRole('alert')
  await expect(alert).toHaveText(PAYOUT_CHANGED, { timeout: 15_000 })
  // refresh(): dòng hiện trạng thái thật, nút biến mất, câu báo còn tại dòng
  await expect(row(page, payout.id).getByTestId('admin-payout-status')).toHaveText('Đã trả')
  await expect(markButton(page, payout.id)).toHaveCount(0)
  await expect(alert).toHaveText(PAYOUT_CHANGED)
  expect(await sellerPayoutsOf(listingId)).toEqual([expect.objectContaining({ id: payout.id, status: 'paid' })])
  expect(errors).toEqual([])
})

test('(c) trang đơn admin: dòng sách cũ hiện "Sách cũ · <tình trạng>" + "Người bán: <tên hiển thị>"', async ({ page }) => {
  test.setTimeout(90_000)
  const { orderCode } = await createPendingPayout(43_000)
  const errors = collectErrors(page)

  await page.goto(`/admin/don-hang/${orderCode}`)
  const used = main(page).getByTestId('order-item-used')
  await expect(used).toHaveCount(1)
  await expect(used).toContainText('Sách cũ · Tốt')
  await expect(used.getByTestId('order-item-seller')).toHaveText(`Người bán: ${seller.fullName}`)
  expect(errors).toEqual([])
})
