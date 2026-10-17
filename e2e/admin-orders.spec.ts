import { expect, type Page } from '@playwright/test'
import {
  bookRow,
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  orderRow,
  placeE2eOrder,
  seedAddress,
  setOrderStatus,
  signedInClient,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import { adminTest as test, main } from './admin'
import { login, NO_SESSION } from './auth'
import { collectErrors, waitForHydration } from './helpers'

// Đơn hàng trong admin: user khách e2e đặt sách e2e (đang bán, trong danh mục gốc ẩn) qua RPC place_order; admin xử lý
// qua UI. Dọn: deleteE2eUsers hủy + xóa đơn (đơn delivered tự hoàn kho) trước khi xóa sách test.

test.describe.configure({ mode: 'serial' })

const STOCK = 20
let customer: E2eUser
let addressId: number
let book: E2eAdminBook
const slugs: string[] = []

test.beforeAll(async () => {
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  book = await createE2eBook({ categoryId: leaf.id, price: 80_000, stock: STOCK })
  slugs.push(book.slug)
  customer = await createE2eUser('admin-orders')
  addressId = await seedAddress(customer.id)
})

test.afterAll(async () => {
  if (customer) await deleteE2eUsers([customer.id])
  await cleanupE2eAdminData(slugs)
})

async function placeOrder(quantity = 1, paymentMethod: 'cod' | 'bank_transfer' = 'cod') {
  return placeE2eOrder(await signedInClient(customer), customer.id, { addressId, bookId: book.id, quantity, paymentMethod })
}

/** Mở trang chi tiết đơn của admin, chờ nút xử lý hydrate (lỗi hiện tại chỗ thay vì POST cả trang) */
async function openOrder(page: Page, code: string) {
  await page.goto(`/admin/don-hang/${code}`)
  await expect(main(page).getByRole('heading', { level: 2, name: code })).toBeVisible()
  await waitForHydration(page, 'main aside form button[type="submit"]')
}

const badge = (page: Page) => main(page).getByTestId('order-status').first()

test('danh sách: tìm theo mã, lọc trạng thái → mở chi tiết', async ({ page }) => {
  const errors = collectErrors(page)
  const order = await placeOrder()

  await page.goto(`/admin/don-hang?q=${order.order_code}`)
  await expect(main(page).getByText('1 đơn', { exact: true })).toBeVisible()
  await page.goto(`/admin/don-hang?status=cancelled&q=${order.order_code}`)
  await expect(main(page).getByText('Không có đơn nào khớp bộ lọc.')).toBeVisible()

  await page.goto('/admin/don-hang?status=pending')
  await main(page).getByLabel('Tìm theo mã đơn, SĐT, tên người nhận').fill(order.order_code.toLowerCase())
  await main(page).getByRole('button', { name: 'Lọc' }).click()
  await expect(page).toHaveURL(new RegExp(`q=${order.order_code.toLowerCase()}`))
  await main(page).getByRole('link', { name: order.order_code }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/don-hang/${order.order_code}$`))
  await expect(badge(page)).toHaveText('Chờ xác nhận')
  await expect(main(page).getByTestId('order-item')).toContainText(book.title)
  expect(errors).toEqual([])
})

test('chờ xác nhận → đã xác nhận → đang giao → đã giao; COD thành đã thanh toán ở trang của khách', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000)
  const errors = collectErrors(page)
  const order = await placeOrder()
  await openOrder(page, order.order_code)
  await expect(main(page).getByTestId('order-payment-status')).toHaveText('Chưa thanh toán')

  const steps = [
    ['Xác nhận đơn', 'Đã xác nhận'],
    ['Chuyển sang đang giao', 'Đang giao'],
    ['Đánh dấu đã giao', 'Đã giao'],
  ] as const
  for (const [button, status] of steps) {
    await main(page).getByRole('button', { name: button }).click()
    await expect(badge(page)).toHaveText(status, { timeout: 15_000 })
    await expect(main(page).getByRole('status').filter({ hasText: 'Đã cập nhật trạng thái đơn.' })).toBeVisible()
  }
  // Trạng thái cuối: không còn nút chuyển, không hủy được
  await expect(main(page).getByRole('button', { name: /Xác nhận đơn|Chuyển sang|Đánh dấu/ })).toHaveCount(0)
  await expect(main(page).getByText('Hủy đơn', { exact: true })).toHaveCount(0)
  await expect(main(page).getByTestId('order-payment-status')).toHaveText('Đã thanh toán')
  expect(errors).toEqual([])

  const context = await browser.newContext({ baseURL, storageState: NO_SESSION })
  const customerPage = await context.newPage()
  await login(customerPage, customer)
  await customerPage.goto(`/tai-khoan/don-hang/${order.order_code}`)
  await expect(customerPage.getByRole('main').getByTestId('order-status')).toHaveText('Đã giao')
  await expect(customerPage.getByRole('main').getByTestId('order-payment-status')).toHaveText('Đã thanh toán')
  await context.close()
})

test('hủy: thiếu lý do → lỗi tại ô; có lý do → hoàn tồn kho, trang sách cập nhật, không còn nút', async ({ page }) => {
  test.setTimeout(60_000)
  // Đặt tới khi chỉ còn 3 cuốn: trang sách hiện "Chỉ còn 3 cuốn", hủy xong phải về "Còn hàng" (cache đã làm mới)
  const stock = (await bookRow(book.id))?.stock ?? 0
  const order = await placeOrder(stock - 3)
  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByText('Chỉ còn 3 cuốn')).toBeVisible()

  await openOrder(page, order.order_code)
  await main(page).getByText('Hủy đơn', { exact: true }).click()
  const confirm = main(page).getByRole('button', { name: 'Xác nhận hủy đơn' })
  await confirm.click()
  await expect(main(page).getByText('Nhập lý do hủy (tối đa 500 ký tự).')).toBeVisible()
  expect((await bookRow(book.id))?.stock).toBe(3)

  await main(page).getByLabel('Lý do hủy').fill('Khách gọi điện đổi ý (e2e)')
  await confirm.click()
  await expect(main(page).getByRole('status').filter({ hasText: 'Đã hủy đơn hàng.' })).toBeVisible({ timeout: 15_000 })
  await expect(badge(page)).toHaveText('Đã hủy')
  await expect(main(page).getByTestId('order-cancelled-reason')).toContainText('Khách gọi điện đổi ý (e2e)')
  await expect(main(page).getByRole('button', { name: /Xác nhận đơn|Xác nhận hủy đơn/ })).toHaveCount(0)
  await expect(main(page).getByText('Hủy đơn', { exact: true })).toHaveCount(0)
  expect((await bookRow(book.id))?.stock).toBe(stock)

  // updateTag(book:{id}) → trang sách công khai thấy tồn kho mới ngay
  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByText('Còn hàng')).toBeVisible()
})

test('khách tự hủy trong lúc admin đang mở trang → admin bấm xác nhận: thông báo + trạng thái mới', async ({ page }) => {
  const order = await placeOrder()
  await openOrder(page, order.order_code)
  await expect(badge(page)).toHaveText('Chờ xác nhận')

  const client = await signedInClient(customer)
  const { error } = await client.rpc('cancel_order', { p_order_id: order.id })
  expect(error).toBeNull()

  await main(page).getByRole('button', { name: 'Xác nhận đơn' }).click()
  await expect(main(page).getByRole('alert')).toHaveText(
    'Đơn hàng vừa đổi trạng thái ở nơi khác. Trang đã cập nhật trạng thái mới.',
    { timeout: 15_000 },
  )
  await expect(badge(page)).toHaveText('Đã hủy')
  await expect(main(page).getByRole('button', { name: 'Xác nhận đơn' })).toHaveCount(0)
})

test('admin gọi thẳng PostgREST: không mở lại đơn đã hủy, không đi lùi / nhảy cóc', async ({ admin }) => {
  const client = await signedInClient(admin)
  const cancelled = await placeOrder()
  const delivered = await placeOrder()
  const pending = await placeOrder()
  await setOrderStatus(cancelled.id, 'cancelled')
  for (const status of ['confirmed', 'shipping', 'delivered'] as const) await setOrderStatus(delivered.id, status)

  const reopen = await client.from('orders').update({ status: 'pending' }).eq('id', cancelled.id)
  expect(reopen.error?.message).toBe('ORDER_REOPEN_FORBIDDEN')
  const back = await client.from('orders').update({ status: 'pending' }).eq('id', delivered.id)
  expect(back.error?.message).toBe('ORDER_INVALID_TRANSITION')
  const skip = await client.from('orders').update({ status: 'delivered' }).eq('id', pending.id)
  expect(skip.error?.message).toBe('ORDER_INVALID_TRANSITION')
})

test('chuyển khoản: "Đã nhận tiền" → đã thanh toán; hủy đơn đã thanh toán → đã hoàn tiền', async ({ page }) => {
  test.setTimeout(60_000)
  const errors = collectErrors(page)
  const order = await placeOrder(1, 'bank_transfer')
  await openOrder(page, order.order_code)
  const paymentStatus = main(page).getByTestId('order-payment-status')
  await expect(paymentStatus).toHaveText('Chưa thanh toán')

  await main(page).getByRole('button', { name: 'Đã nhận tiền' }).click()
  await expect(main(page).getByRole('status').filter({ hasText: 'Đã ghi nhận thanh toán.' })).toBeVisible({ timeout: 15_000 })
  await expect(paymentStatus).toHaveText('Đã thanh toán')
  await expect(main(page).getByRole('button', { name: 'Đã nhận tiền' })).toHaveCount(0)
  await expect(main(page).getByTestId('order-refund-note')).toBeVisible()
  expect(await orderRow(order.id)).toMatchObject({ payment_method: 'bank_transfer', payment_status: 'paid' })

  await main(page).getByText('Hủy đơn', { exact: true }).click()
  await main(page).getByLabel('Lý do hủy').fill('Hết hàng, hoàn tiền cho khách (e2e)')
  await main(page).getByRole('button', { name: 'Xác nhận hủy đơn' }).click()
  await expect(badge(page)).toHaveText('Đã hủy', { timeout: 15_000 })
  await expect(paymentStatus).toHaveText('Đã hoàn tiền')
  expect(await orderRow(order.id)).toMatchObject({ status: 'cancelled', payment_status: 'refunded' })
  expect(errors).toEqual([])
})

test('COD không có nút "Đã nhận tiền"', async ({ page }) => {
  const order = await placeOrder()
  await openOrder(page, order.order_code)
  await expect(main(page).getByRole('button', { name: 'Đã nhận tiền' })).toHaveCount(0)
})

test('danh sách đơn: không prefetch link khi chỉ hiện trên màn hình; rê chuột vào một đơn mới prefetch', async ({ page }) => {
  const order = await placeOrder()
  const prefetches: string[] = []
  page.on('request', (request) => {
    if (request.headers()['next-router-prefetch']) prefetches.push(request.url())
  })
  await page.goto('/admin/don-hang')
  const link = main(page).getByRole('link', { name: order.order_code })
  await expect(link).toBeVisible()
  await waitForHydration(page, `main a[href="/admin/don-hang/${order.order_code}"]`)
  await page.waitForTimeout(1_500)
  expect(prefetches).toEqual([])

  await link.hover()
  await expect.poll(() => prefetches.some((url) => url.includes(`/admin/don-hang/${order.order_code}`))).toBe(true)
})
