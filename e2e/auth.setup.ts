import { test as setup } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { cleanupE2eUsers, createE2eUser, createShopBooks, makeAdmin } from '../scripts/e2e-user'
import {
  ACCOUNT_PROJECTS,
  ADMIN_CREDENTIALS_PATH,
  ADMIN_PROJECTS,
  adminStatePath,
  checkoutStatePath,
  CREDENTIALS_PATH,
  login,
  NO_SESSION,
  ordersStatePath,
  SHOP_BOOKS_PATH,
  storageStatePath,
  type AdminCredentials,
  type Credentials,
  type ShopBooksFile,
} from './auth'

// Tạo user test bằng admin API (không gửi email), đăng nhập một lần qua UI và lưu storageState cho các test cần phiên.
// Một setup cho cả tài khoản lẫn admin: cleanupE2eUsers xóa MỌI user e2e, hai setup chạy song song sẽ xóa user của nhau.
setup('tạo tài khoản e2e, đăng nhập sẵn', async ({ browser, baseURL }) => {
  setup.setTimeout(240_000)
  await cleanupE2eUsers()
  mkdirSync(dirname(CREDENTIALS_PATH), { recursive: true })

  const credentials: Credentials = {}
  for (const project of ACCOUNT_PROJECTS) {
    const [user, checkout, orders] = await Promise.all([
      createE2eUser(project),
      createE2eUser(`${project}-checkout`),
      createE2eUser(`${project}-orders`),
    ])
    credentials[project] = { user, checkout, orders }
  }
  const admins: AdminCredentials = {}
  for (const project of ADMIN_PROJECTS) {
    const admin = await createE2eUser(project)
    admins[project] = admin
  }
  // Ghi trước khi đăng nhập: setup lỗi giữa chừng thì teardown vẫn biết user nào cần xóa
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2))
  writeFileSync(ADMIN_CREDENTIALS_PATH, JSON.stringify(admins, null, 2))
  const shopBooks: ShopBooksFile = {}
  for (const project of ACCOUNT_PROJECTS) shopBooks[project] = await createShopBooks(project)
  writeFileSync(SHOP_BOOKS_PATH, JSON.stringify(shopBooks, null, 2))
  await Promise.all(Object.values(admins).map((admin) => makeAdmin(admin.id)))

  const sessions = [
    ...ACCOUNT_PROJECTS.flatMap((project) => {
      const users = credentials[project]
      if (!users) throw new Error(`Thiếu user cho ${project}`)
      return [
        { user: users.user, path: storageStatePath(project) },
        { user: users.checkout, path: checkoutStatePath(project) },
        { user: users.orders, path: ordersStatePath(project) },
      ]
    }),
    ...ADMIN_PROJECTS.map((project) => {
      const admin = admins[project]
      if (!admin) throw new Error(`Thiếu admin cho ${project}`)
      return { user: admin, path: adminStatePath(project) }
    }),
  ]
  for (const { user, path } of sessions) {
    const context = await browser.newContext({ baseURL, storageState: NO_SESSION })
    await login(await context.newPage(), user)
    await context.storageState({ path })
    await context.close()
  }
})
