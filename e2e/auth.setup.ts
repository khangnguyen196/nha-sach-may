import { test as setup } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { cleanupE2eUsers, createE2eUser } from '../scripts/e2e-user'
import { ACCOUNT_PROJECTS, CREDENTIALS_PATH, login, NO_SESSION, storageStatePath, type Credentials } from './auth'

// Tạo user test bằng admin API (không gửi email), đăng nhập một lần qua UI và lưu storageState cho các test cần phiên.
setup('tạo tài khoản e2e, đăng nhập sẵn', async ({ browser, baseURL }) => {
  setup.setTimeout(120_000)
  await cleanupE2eUsers()
  mkdirSync(dirname(CREDENTIALS_PATH), { recursive: true })

  const credentials: Credentials = {}
  for (const project of ACCOUNT_PROJECTS) {
    const [user, reset] = await Promise.all([createE2eUser(project), createE2eUser(`${project}-reset`)])
    credentials[project] = { user, reset }
  }
  // Ghi trước khi đăng nhập: setup lỗi giữa chừng thì teardown vẫn biết user nào cần xóa
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2))

  for (const project of ACCOUNT_PROJECTS) {
    const context = await browser.newContext({ baseURL, storageState: NO_SESSION })
    const page = await context.newPage()
    const users = credentials[project]
    if (!users) throw new Error(`Thiếu user cho ${project}`)
    await login(page, users.user)
    await context.storageState({ path: storageStatePath(project) })
    await context.close()
  }
})
