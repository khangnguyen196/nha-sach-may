import { test as teardown } from '@playwright/test'
import { existsSync, rmSync } from 'node:fs'
import { deleteE2eUsers } from '../scripts/e2e-user'
import { CREDENTIALS_PATH, readCredentials } from './auth'

// Xóa đúng các user setup vừa tạo (cascade xóa profile + địa chỉ). User sót do lần chạy bị ngắt thì setup lần sau dọn.
teardown('xóa tài khoản e2e', async () => {
  if (!existsSync(CREDENTIALS_PATH)) return
  const ids = Object.values(readCredentials()).flatMap(({ user, reset }) => [user.id, reset.id])
  await deleteE2eUsers(ids)
  rmSync(CREDENTIALS_PATH)
})
