import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { waitForHydration } from './helpers'

// Mỗi project tài khoản (playwright.config.ts) một user chính + một user cho test đặt lại mật khẩu + một user cho
// checkout: trên CI hai project (và các file spec) chạy song song, dùng chung user thì test sổ địa chỉ / đổi mật khẩu /
// giỏ / đặt hàng giẫm lên nhau.
export const ACCOUNT_PROJECTS = ['desktop-account', 'mobile-account'] as const

const AUTH_DIR = 'e2e/.auth'
export const CREDENTIALS_PATH = `${AUTH_DIR}/credentials.json`
export const storageStatePath = (project: string) => `${AUTH_DIR}/${project}.json`
/** Phiên đăng nhập sẵn của user checkout */
export const checkoutStatePath = (project: string) => `${AUTH_DIR}/${project}-checkout.json`

const userSchema = z.object({ id: z.string(), email: z.string(), password: z.string(), fullName: z.string() })
const credentialsSchema = z.record(z.string(), z.object({ user: userSchema, reset: userSchema, checkout: userSchema }))

export type Credentials = z.infer<typeof credentialsSchema>
export type ProjectUsers = Credentials[string]

export function readCredentials(): Credentials {
  return credentialsSchema.parse(JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8')))
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
