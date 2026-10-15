import { expect, test } from '@playwright/test'
import {
  bookRow,
  cancelAndDeleteOrders,
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  ordersOf,
  placeE2eOrder,
  seedAddress,
  setOrderStatus,
  signedInClient,
  type E2eUser,
} from '../scripts/e2e-user'

// Dọn dữ liệu e2e khi đơn đã giao: trigger chặn delivered → cancelled với mọi role (kể cả service role), nên
// cancelAndDeleteOrders phải tự hoàn kho cho đơn delivered. Không mở trình duyệt; chỉ chạy ở desktop-admin.
// Sách test đang bán trong danh mục test ẩn (không lên menu), user test riêng, xóa hết ở finally.

test('cancelAndDeleteOrders: đơn đã giao và đơn đang chờ đều bị xóa, tồn kho + sold_count về như trước khi đặt', async () => {
  test.setTimeout(60_000)
  let user: E2eUser | undefined
  const slugs: string[] = []
  try {
    const root = await createE2eCategory({ active: false })
    const leaf = await createE2eCategory({ parentId: root.id })
    const book = await createE2eBook({ categoryId: leaf.id, stock: 10 })
    slugs.push(root.slug, leaf.slug, book.slug)
    user = await createE2eUser('admin-cleanup')
    const addressId = await seedAddress(user.id)
    const client = await signedInClient(user)

    const delivered = (await placeE2eOrder(client, user.id, { addressId, bookId: book.id, quantity: 2 })).id
    await placeE2eOrder(client, user.id, { addressId, bookId: book.id, quantity: 1 })
    // Đi đúng luồng: trigger chặn nhảy cóc pending → delivered
    for (const status of ['confirmed', 'shipping', 'delivered'] as const) await setOrderStatus(delivered, status)

    expect(await bookRow(book.id)).toMatchObject({ stock: 7, sold_count: 3 })
    expect((await ordersOf(user.id)).map((order) => order.status).sort()).toEqual(['delivered', 'pending'])

    await cancelAndDeleteOrders([user.id])

    expect(await ordersOf(user.id)).toEqual([])
    expect(await bookRow(book.id)).toMatchObject({ stock: 10, sold_count: 0 })
  } finally {
    if (user) await deleteE2eUsers([user.id])
    await cleanupE2eAdminData(slugs)
  }
})
