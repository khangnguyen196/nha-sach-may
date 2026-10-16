import { expect } from '@playwright/test'
import {
  cancelAndDeleteOrders,
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteAddress,
  deleteE2eUsers,
  placeE2eOrder,
  seedAddress,
  signedInClient,
  type E2eUser,
} from '../scripts/e2e-user'
import { adminTest as test, main } from './admin'
import { readAdminCredentials } from './auth'

// Lỗi test tay (2026-10-16): trang tài khoản của admin phải như của khách thường, chỉ đơn của chính admin. Query đơn
// phía khách (getOrderByCode, danh sách đơn) chỉ dựa vào RLS, mà policy orders_select_own_or_admin cho admin đọc mọi
// đơn → admin thấy đơn của mọi người ở /tai-khoan/don-hang, /tai-khoan/don-hang/[code], /thanh-toan/thanh-cong/[code].

// 'default': chạy tuần tự trong một worker; test fail không làm bỏ qua test sau (khác 'serial')
test.describe.configure({ mode: 'default' })

let customer: E2eUser | undefined
let adminId: string | undefined
let adminAddressId: number | undefined
let customerCode = ''
let adminCode = ''
const slugs: string[] = []

test.beforeAll(async ({}, testInfo) => {
  const admin = readAdminCredentials()[testInfo.project.name]
  if (!admin) throw new Error(`Không có admin e2e cho project ${testInfo.project.name}`)
  adminId = admin.id

  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  const book = await createE2eBook({ categoryId: leaf.id, price: 80_000, stock: 20 })
  slugs.push(book.slug)

  customer = await createE2eUser('admin-account-orders')
  const customerAddress = await seedAddress(customer.id)
  const customerOrder = await placeE2eOrder(await signedInClient(customer), customer.id, {
    addressId: customerAddress,
    bookId: book.id,
    quantity: 1,
  })
  customerCode = customerOrder.order_code

  adminAddressId = await seedAddress(admin.id)
  const adminOrder = await placeE2eOrder(await signedInClient(admin), admin.id, {
    addressId: adminAddressId,
    bookId: book.id,
    quantity: 1,
  })
  adminCode = adminOrder.order_code
})

test.afterAll(async () => {
  if (customer) await deleteE2eUsers([customer.id])
  if (adminId) await cancelAndDeleteOrders([adminId])
  if (adminAddressId !== undefined) await deleteAddress(adminAddressId)
  await cleanupE2eAdminData(slugs)
})

test('admin mở /tai-khoan/don-hang chỉ thấy đơn của mình; đơn của khách khác → 404', async ({ page }) => {
  await page.goto('/tai-khoan/don-hang')
  const codes = main(page).getByTestId('order-row-code')
  await expect(codes.filter({ hasText: adminCode })).toHaveCount(1)
  await expect(codes.filter({ hasText: customerCode })).toHaveCount(0)

  await page.goto(`/tai-khoan/don-hang/${customerCode}`)
  await expect(main(page).getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
})

// Cùng nguyên nhân: trang "Đặt hàng thành công" cũng đọc đơn bằng getOrderByCode
test('admin mở trang đặt hàng thành công của đơn khách khác → 404', async ({ page }) => {
  await page.goto(`/thanh-toan/thanh-cong/${customerCode}`)
  await expect(main(page).getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
})
