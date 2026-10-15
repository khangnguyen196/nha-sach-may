import { test as teardown } from '@playwright/test'
import { existsSync, rmSync } from 'node:fs'
import { deleteE2eUsers } from '../scripts/e2e-user'
import { CREDENTIALS_PATH, readCredentials } from './auth'

// Xóa đúng các user setup vừa tạo (deleteE2eUsers hủy + xóa đơn trước để hoàn tồn kho; cascade xóa profile, địa chỉ,
// giỏ). User sót do lần chạy bị ngắt thì setup lần sau dọn.
teardown('xóa tài khoản e2e', async () => {
  if (!existsSync(CREDENTIALS_PATH)) return
  const ids = Object.values(readCredentials()).flatMap(({ user, reset, checkout }) => [user.id, reset.id, checkout.id])
  await deleteE2eUsers(ids)
  rmSync(CREDENTIALS_PATH)
})
