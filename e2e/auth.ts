import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { waitForHydration } from './helpers'

// Mỗi project tài khoản (playwright.config.ts) một user chính + một user cho checkout + một user cho đơn hàng: trên CI
// hai project (và các file spec) chạy song song, dùng chung user thì test sổ địa chỉ / giỏ / đặt hàng / đơn hàng giẫm
// lên nhau (checkout.spec xóa mọi đơn của user checkout sau mỗi test). Test đặt lại mật khẩu
// tự tạo user riêng cho mỗi lần chạy (account.spec.ts).
export const ACCOUNT_PROJECTS = ['desktop-account', 'mobile-account'] as const

const AUTH_DIR = 'e2e/.auth'
export const CREDENTIALS_PATH = `${AUTH_DIR}/credentials.json`
export const storageStatePath = (project: string) => `${AUTH_DIR}/${project}.json`
/** Phiên đăng nhập sẵn của user checkout */
export const checkoutStatePath = (project: string) => `${AUTH_DIR}/${project}-checkout.json`
/** Phiên đăng nhập sẵn của user đơn hàng (orders.spec.ts) */
export const ordersStatePath = (project: string) => `${AUTH_DIR}/${project}-orders.json`

const userSchema = z.object({ id: z.string(), email: z.string(), password: z.string(), fullName: z.string() })
const credentialsSchema = z.record(z.string(), z.object({ user: userSchema, checkout: userSchema, orders: userSchema }))

export type Credentials = z.infer<typeof credentialsSchema>
export type ProjectUsers = Credentials[string]

export function readCredentials(): Credentials {
  return credentialsSchema.parse(JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8')))
}

// Admin (Phase 7): mỗi project admin một user có role = 'admin', file riêng để không đổi dạng credentials.json
export const ADMIN_PROJECTS = ['desktop-admin', 'mobile-admin'] as const
export const ADMIN_CREDENTIALS_PATH = `${AUTH_DIR}/admin-credentials.json`
export const adminStatePath = (project: string) => `${AUTH_DIR}/${project}-admin.json`

const adminCredentialsSchema = z.record(z.string(), userSchema)

export type AdminCredentials = z.infer<typeof adminCredentialsSchema>

export function readAdminCredentials(): AdminCredentials {
  return adminCredentialsSchema.parse(JSON.parse(readFileSync(ADMIN_CREDENTIALS_PATH, 'utf8')))
}

export const NO_SESSION = { cookies: [], origins: [] }

/** Đăng nhập qua form (chờ hydrate để lỗi hiện tại chỗ thay vì POST cả trang) */
export async function fillLogin(page: Page, { email, password }: { email: string; password: string }) {
  await waitForHydration(page, 'form button[type="submit"]')
  await page.getByRole('main').getByLabel('Email').fill(email)
  await page.getByRole('main').getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
}

export async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/dang-nhap')
  await fillLogin(page, user)
  // Đăng nhập gọi Supabase Auth qua mạng: lúc mạng chậm có thể quá 5s mặc định
  await expect(page).toHaveURL(/\/tai-khoan$/, { timeout: 20_000 })
}
