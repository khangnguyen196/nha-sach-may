import { test as teardown } from '@playwright/test'
import { existsSync, rmSync } from 'node:fs'
import { cleanupE2eAdminData, deleteE2eUsers } from '../scripts/e2e-user'
import { ADMIN_CREDENTIALS_PATH, CREDENTIALS_PATH, readAdminCredentials, readCredentials } from './auth'

// Xóa đúng các user setup vừa tạo (deleteE2eUsers hủy + xóa đơn trước để hoàn tồn kho; cascade xóa profile, địa chỉ,
// giỏ), rồi dữ liệu admin e2e còn sót. User sót do lần chạy bị ngắt thì setup lần sau dọn.
teardown('xóa tài khoản e2e', async () => {
  if (existsSync(CREDENTIALS_PATH)) {
    const ids = Object.values(readCredentials()).flatMap(({ user, checkout, orders }) => [user.id, checkout.id, orders.id])
    await deleteE2eUsers(ids)
    rmSync(CREDENTIALS_PATH)
  }
  if (existsSync(ADMIN_CREDENTIALS_PATH)) {
    await deleteE2eUsers(Object.values(readAdminCredentials()).map((admin) => admin.id))
    rmSync(ADMIN_CREDENTIALS_PATH)
  }
  await cleanupE2eAdminData()
})
