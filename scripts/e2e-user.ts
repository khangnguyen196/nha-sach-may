/**
 * Tài khoản test cho e2e (Playwright setup/teardown + test đặt lại mật khẩu). Chạy local, không import vào src/.
 *
 * Env (.env.local, nạp bằng process.loadEnvFile; không in giá trị):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  — kiểm tra refresh token / đăng nhập như một client bình thường
 *   SUPABASE_SERVICE_ROLE_KEY            — admin API: tạo / xóa user, sinh link đặt lại mật khẩu (không gửi email)
 *
 * Email luôn có dạng e2e+<random>[-<nhãn>]@example.com; cleanupE2eUsers() xóa mọi user khớp mẫu này
 * (user còn sót khi lần chạy trước bị ngắt).
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import type { Database } from '../src/types/database'

export type E2eUser = { id: string; email: string; password: string; fullName: string }

const E2E_EMAIL = /^e2e\+[a-z0-9-]+@example\.com$/

function loadEnv() {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    /* đã có env từ shell (CI) */
  }
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Thiếu ${name} (chạy npm run check:env)`)
  return value
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

function adminClient() {
  loadEnv()
  return createClient<Database>(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), clientOptions)
}

function anonClient() {
  loadEnv()
  return createClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    clientOptions,
  )
}

const random = () => randomBytes(6).toString('hex')

/** Xóa mọi user e2e còn sót (listUsers phân trang). Profile + địa chỉ xóa theo cascade. */
export async function cleanupE2eUsers() {
  const admin = adminClient()
  const stale: string[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    stale.push(...data.users.filter((user) => E2E_EMAIL.test(user.email ?? '')).map((user) => user.id))
    if (data.users.length < 1000) break
  }
  await deleteE2eUsers(stale)
  return stale.length
}

export async function deleteE2eUsers(ids: string[]) {
  const admin = adminClient()
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error && error.status !== 404) throw new Error(`deleteUser: ${error.message}`)
  }
}

/** User đã xác nhận email (email_confirm: true → không gửi thư). `label` thêm vào email để dễ nhận ra. */
export async function createE2eUser(label?: string): Promise<E2eUser> {
  const email = `e2e+${random()}${label ? `-${label}` : ''}@example.com`
  const password = `E2e-${randomBytes(12).toString('base64url')}`
  const fullName = 'Kiểm Thử E2E'
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, locale: 'vi' },
  })
  if (error || !data.user) throw new Error(`createUser: ${error?.message ?? 'không có user'}`)
  return { id: data.user.id, email, password, fullName }
}

/** hashed_token của link đặt lại mật khẩu, lấy qua admin API thay vì gửi email */
export async function recoveryTokenHash(email: string) {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: 'recovery', email })
  if (error) throw new Error(`generateLink: ${error.message}`)
  return data.properties.hashed_token
}

/** Refresh token còn dùng được không (phiên chưa bị thu hồi) */
export async function canRefresh(refreshToken: string) {
  const { error } = await anonClient().auth.refreshSession({ refresh_token: refreshToken })
  return !error
}

export async function canSignIn(email: string, password: string) {
  const { error } = await anonClient().auth.signInWithPassword({ email, password })
  return !error
}

/** Xóa sạch sổ địa chỉ của user (test sổ địa chỉ bắt đầu từ trạng thái rỗng, chạy lại được) */
export async function clearAddresses(userId: string) {
  const { error } = await adminClient().from('addresses').delete().eq('user_id', userId)
  if (error) throw new Error(`clearAddresses: ${error.message}`)
}

/**
 * Refresh token trong cookie phiên của @supabase/ssr: `sb-<ref>-auth-token` (có thể chia `.0`, `.1`…),
 * giá trị `base64-<base64url(JSON phiên)>`.
 */
export function refreshTokenFromCookies(cookies: { name: string; value: string }[]) {
  const chunks = cookies
    .filter((cookie) => /^sb-[^-]+-auth-token(\.\d+)?$/.test(cookie.name))
    .sort((a, b) => chunkIndex(a.name) - chunkIndex(b.name))
    .map((cookie) => cookie.value)
  if (chunks.length === 0) throw new Error('Không có cookie phiên Supabase')
  const raw = chunks.join('')
  const json = raw.startsWith('base64-') ? Buffer.from(raw.slice('base64-'.length), 'base64url').toString('utf8') : raw
  const session: unknown = JSON.parse(json)
  const token = typeof session === 'object' && session !== null ? Reflect.get(session, 'refresh_token') : undefined
  if (typeof token !== 'string') throw new Error('Cookie phiên không có refresh_token')
  return token
}

function chunkIndex(name: string) {
  const match = /\.(\d+)$/.exec(name)
  return match ? Number(match[1]) : -1
}

/** Xóa sạch giỏ tài khoản của user (test giỏ bắt đầu từ giỏ rỗng, chạy lại được) */
export async function clearCart(userId: string) {
  const { error } = await adminClient().from('cart_items').delete().eq('user_id', userId)
  if (error) throw new Error(`clearCart: ${error.message}`)
}

/** book_id → quantity trong giỏ tài khoản (kiểm tra gộp giỏ không bị cộng hai lần) */
export async function cartQuantities(userId: string) {
  const { data, error } = await adminClient().from('cart_items').select('book_id, quantity').eq('user_id', userId)
  if (error) throw new Error(`cartQuantities: ${error.message}`)
  return Object.fromEntries(data.map((row) => [row.book_id, row.quantity]))
}

export type E2eBook = { id: number; slug: string; title: string; price: number; stock: number }

/** Sách đang bán có tồn kho trong [min, max], theo id (ổn định giữa các lần chạy). Quyền anon, không cần service key. */
export async function findBooksByStock(min: number, max: number, limit = 1): Promise<E2eBook[]> {
  const { data, error } = await anonClient()
    .from('books')
    .select('id, slug, title, price, stock')
    .gte('stock', min)
    .lte('stock', max)
    .order('id')
    .limit(limit)
  if (error) throw new Error(`findBooksByStock: ${error.message}`)
  return data
}
