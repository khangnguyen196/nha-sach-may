import { expect } from '@playwright/test'
import sharp from 'sharp'
import {
  bookRow,
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  signedInClient,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import { adminTest as test } from './admin'
import { login, NO_SESSION } from './auth'

// Bốn lớp bảo vệ của admin (docs/plans/phase-7.md → Bảo mật): proxy + layout chặn trang; Server Action tự kiểm tra
// (test tĩnh actions.test.ts); RLS + quyền cột + giới hạn bucket là lớp cuối khi gọi thẳng PostgREST / Storage.

test.describe.configure({ mode: 'serial' })

let customer: E2eUser
let book: E2eAdminBook
const slugs: string[] = []

test.beforeAll(async () => {
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  book = await createE2eBook({ categoryId: leaf.id, price: 80_000 })
  slugs.push(book.slug)
  customer = await createE2eUser('admin-security')
})

test.afterAll(async () => {
  if (customer) await deleteE2eUsers([customer.id])
  await cleanupE2eAdminData(slugs)
})

const cover = () => sharp({ create: { width: 60, height: 90, channels: 3, background: '#444' } })

test('khách và user thường vào /admin → về trang chủ', async ({ browser, baseURL }) => {
  const guest = await browser.newContext({ baseURL, storageState: NO_SESSION })
  const guestPage = await guest.newPage()
  await guestPage.goto('/admin/sach')
  await expect(guestPage).toHaveURL(`${baseURL}/`)
  await guest.close()

  const context = await browser.newContext({ baseURL, storageState: NO_SESSION })
  const page = await context.newPage()
  await login(page, customer)
  await page.goto('/admin')
  await expect(page).toHaveURL(`${baseURL}/`)
  await page.goto(`/admin/sach/${book.id}`)
  await expect(page).toHaveURL(`${baseURL}/`)
  await context.close()
})

test('user thường gọi thẳng PostgREST / Storage: không sửa được sách, đơn, bìa', async () => {
  const client = await signedInClient(customer)

  const books = await client.from('books').update({ price: 1 }).eq('id', book.id).select('id')
  expect(books.data ?? []).toEqual([])
  const orders = await client.from('orders').update({ status: 'confirmed' }).gt('id', 0).select('id')
  expect(orders.data ?? []).toEqual([])
  expect((await bookRow(book.id))?.price).toBe(80_000)

  const upload = await client.storage
    .from('book-covers')
    .upload(`e2e-admin-${book.id}-customer.webp`, await cover().webp().toBuffer(), { contentType: 'image/webp' })
  expect(upload.error).not.toBeNull()
})

test('admin gọi thẳng PostgREST: sửa được cột admin, không sửa được tiền đơn / cột do DB quản lý; bucket chỉ nhận WebP', async ({
  admin,
}) => {
  const client = await signedInClient(admin)

  const allowed = await client.from('books').update({ stock: 9 }).eq('id', book.id).select('id')
  expect(allowed.error).toBeNull()
  expect(allowed.data).toHaveLength(1)

  // Quyền cột (migration admin.sql): Postgres từ chối cả câu lệnh, kể cả khi không khớp dòng nào
  const orderTotal = await client.from('orders').update({ total: 1 }).eq('id', -1)
  expect(orderTotal.error?.message).toMatch(/permission denied/)
  const soldCount = await client.from('books').update({ sold_count: 999 }).eq('id', book.id)
  expect(soldCount.error?.message).toMatch(/permission denied/)
  expect((await bookRow(book.id))?.sold_count).toBe(0)

  // Bucket chỉ nhận image/webp ≤ 1MB, kể cả khi có phiên admin
  const path = `e2e-admin-${book.id}-direct.png`
  const png = await client.storage.from('book-covers').upload(path, await cover().png().toBuffer(), { contentType: 'image/png' })
  if (!png.error) await client.storage.from('book-covers').remove([path])
  expect(png.error).not.toBeNull()
})
