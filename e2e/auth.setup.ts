import { test as setup } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { cleanupE2eUsers, createE2eUser } from '../scripts/e2e-user'
import {
  ACCOUNT_PROJECTS,
  checkoutStatePath,
  CREDENTIALS_PATH,
  login,
  NO_SESSION,
  storageStatePath,
  type Credentials,
} from './auth'

// Tạo user test bằng admin API (không gửi email), đăng nhập một lần qua UI và lưu storageState cho các test cần phiên.
setup('tạo tài khoản e2e, đăng nhập sẵn', async ({ browser, baseURL }) => {
  setup.setTimeout(180_000)
  await cleanupE2eUsers()
  mkdirSync(dirname(CREDENTIALS_PATH), { recursive: true })

  const credentials: Credentials = {}
  for (const project of ACCOUNT_PROJECTS) {
    const [user, reset, checkout] = await Promise.all([
      createE2eUser(project),
      createE2eUser(`${project}-reset`),
      createE2eUser(`${project}-checkout`),
    ])
    credentials[project] = { user, reset, checkout }
  }
  // Ghi trước khi đăng nhập: setup lỗi giữa chừng thì teardown vẫn biết user nào cần xóa
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2))

  for (const project of ACCOUNT_PROJECTS) {
    const users = credentials[project]
    if (!users) throw new Error(`Thiếu user cho ${project}`)
    const sessions = [
      { user: users.user, path: storageStatePath(project) },
      { user: users.checkout, path: checkoutStatePath(project) },
    ]
    for (const { user, path } of sessions) {
      const context = await browser.newContext({ baseURL, storageState: NO_SESSION })
      await login(await context.newPage(), user)
      await context.storageState({ path })
      await context.close()
    }
  }
})
