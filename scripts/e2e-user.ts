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

/**
 * Xóa mọi user e2e còn sót (listUsers phân trang) + đơn của họ + sách ẩn + dữ liệu admin của test.
 * Profile + địa chỉ xóa theo cascade.
 */
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
  await Promise.all([deleteHiddenBooks(), cleanupE2eAdminData()])
  return stale.length
}

/** Đơn của user bị hủy + xóa trước (hoàn tồn kho), rồi mới xóa user */
export async function deleteE2eUsers(ids: string[]) {
  await cancelAndDeleteOrders(ids)
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

/**
 * Sách đang bán có tồn kho trong [min, max], theo id (ổn định giữa các lần chạy). Quyền anon, không cần service key.
 * Bỏ sách của chính e2e (slug e2e-…): sách test của admin đang bán và có id lớn nhất, spec khác lấy nhầm thì sách bị
 * xóa giữa chừng.
 */
export async function findBooksByStock(min: number, max: number, limit = 1): Promise<E2eBook[]> {
  const { data, error } = await anonClient()
    .from('books')
    .select('id, slug, title, price, stock')
    .gte('stock', min)
    .lte('stock', max)
    .not('slug', 'like', 'e2e-%')
    .order('id')
    .limit(limit)
  if (error) throw new Error(`findBooksByStock: ${error.message}`)
  return data
}

/** Sách đang bán có tồn kho trong [min, max], id giảm dần: checkout lấy từ cuối danh sách để không trùng sách của spec giỏ */
export async function findBooksByStockDesc(min: number, max: number, limit = 1): Promise<E2eBook[]> {
  const { data, error } = await anonClient()
    .from('books')
    .select('id, slug, title, price, stock')
    .gte('stock', min)
    .lte('stock', max)
    .not('slug', 'like', 'e2e-%')
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`findBooksByStockDesc: ${error.message}`)
  return data
}

/** Thêm địa chỉ (admin). Tên tỉnh / phường đầy đủ tiếng Việt như addressSchema ghi vào DB. */
export async function seedAddress(userId: string, { recipient = 'Người Nhận E2E', isDefault = true } = {}) {
  const { data, error } = await adminClient()
    .from('addresses')
    .insert({
      user_id: userId,
      recipient_name: recipient,
      phone: '0912345678',
      province: 'Thành phố Hà Nội',
      ward: 'Phường Ba Đình',
      street: '12 Phố Huế',
      is_default: isDefault,
    })
    .select('id')
    .single()
  if (error) throw new Error(`seedAddress: ${error.message}`)
  return data.id
}

export async function deleteAddress(id: number) {
  const { error } = await adminClient().from('addresses').delete().eq('id', id)
  if (error) throw new Error(`deleteAddress: ${error.message}`)
}

/** Đặt số lượng một dòng giỏ tài khoản (admin, bỏ qua kiểm tra tồn kho của app) */
export async function setCartItem(userId: string, bookId: number, quantity: number) {
  const { error } = await adminClient()
    .from('cart_items')
    .upsert({ user_id: userId, book_id: bookId, quantity }, { onConflict: 'user_id,book_id' })
  if (error) throw new Error(`setCartItem: ${error.message}`)
}

export async function stockOf(bookId: number) {
  const { data, error } = await adminClient().from('books').select('stock').eq('id', bookId).single()
  if (error) throw new Error(`stockOf: ${error.message}`)
  return data.stock
}

/** Đơn của user (admin), mới nhất trước, kèm dòng sách */
export async function ordersOf(userId: string) {
  const { data, error } = await adminClient()
    .from('orders')
    .select('id, order_code, status, payment_method, payment_status, note, subtotal, shipping_fee, total, order_items(book_id, quantity)')
    .eq('user_id', userId)
    .order('id', { ascending: false })
  if (error) throw new Error(`ordersOf: ${error.message}`)
  return data
}

/**
 * Xóa mọi đơn của user và hoàn tồn kho của sách trong đơn. Phải chạy trước khi xóa user (orders.user_id là
 * on delete set null → đơn mồ côi, tồn kho bị trừ mãi).
 * - Đơn chưa giao: hủy → trigger handle_order_status_change hoàn stock / sold_count / used_count → xóa.
 * - Đơn đã giao: trigger chặn delivered → cancelled với MỌI role (kể cả service role), nên tự hoàn kho
 *   (deleteDeliveredOrders). Không tách thì một đơn delivered làm hỏng cả câu update hủy: sót đơn, không hoàn kho.
 */
export async function cancelAndDeleteOrders(userIds: string[]) {
  if (userIds.length === 0) return
  const admin = adminClient()
  await deleteDeliveredOrders(admin, userIds)
  const { error: cancelError } = await admin
    .from('orders')
    .update({ status: 'cancelled', cancelled_reason: 'e2e cleanup' })
    .in('user_id', userIds)
    .in('status', ['pending', 'confirmed', 'shipping'])
  if (cancelError) throw new Error(`cancelAndDeleteOrders (cancel): ${cancelError.message}`)
  const { error } = await admin.from('orders').delete().in('user_id', userIds)
  if (error) throw new Error(`cancelAndDeleteOrders (delete): ${error.message}`)
}

type AdminClient = ReturnType<typeof adminClient>

/**
 * Đơn delivered: đọc dòng sách → xóa đơn → cộng lại stock, trừ sold_count (không âm), giảm used_count của voucher, như
 * trigger làm khi hủy. Thứ tự "đọc → xóa → hoàn kho": lỗi giữa chừng thì thiếu hoàn kho chứ không hoàn hai lần khi
 * chạy lại.
 */
async function deleteDeliveredOrders(admin: AdminClient, userIds: string[]) {
  const { data: orders, error } = await admin
    .from('orders')
    .select('id, voucher_id, order_items(book_id, quantity)')
    .in('user_id', userIds)
    .eq('status', 'delivered')
  if (error) throw new Error(`deleteDeliveredOrders (read): ${error.message}`)
  if (orders.length === 0) return

  const ids = orders.map((order) => order.id)
  const { error: deleteError } = await admin.from('orders').delete().in('id', ids)
  if (deleteError) throw new Error(`deleteDeliveredOrders (delete): ${deleteError.message}`)

  const quantities = new Map<number, number>()
  const vouchers = new Map<number, number>()
  for (const order of orders) {
    for (const item of order.order_items) {
      if (item.book_id !== null) quantities.set(item.book_id, (quantities.get(item.book_id) ?? 0) + item.quantity)
    }
    if (order.voucher_id !== null) vouchers.set(order.voucher_id, (vouchers.get(order.voucher_id) ?? 0) + 1)
  }
  for (const [bookId, quantity] of quantities) await restock(admin, bookId, quantity)
  for (const [voucherId, count] of vouchers) await releaseVoucher(admin, voucherId, count)
}

// PostgREST không có phép cộng nguyên tử (stock = stock + n) nên đọc rồi ghi. Đơn được giao chỉ có ở test admin đơn
// hàng, trên sách e2e riêng của test → không tranh chấp với spec khác.
async function restock(admin: AdminClient, bookId: number, quantity: number) {
  const { data, error } = await admin.from('books').select('stock, sold_count').eq('id', bookId).maybeSingle()
  if (error) throw new Error(`restock (read): ${error.message}`)
  if (!data) return
  const { error: updateError } = await admin
    .from('books')
    .update({ stock: data.stock + quantity, sold_count: Math.max(data.sold_count - quantity, 0) })
    .eq('id', bookId)
  if (updateError) throw new Error(`restock (update): ${updateError.message}`)
}

async function releaseVoucher(admin: AdminClient, voucherId: number, count: number) {
  const { data, error } = await admin.from('vouchers').select('used_count').eq('id', voucherId).maybeSingle()
  if (error) throw new Error(`releaseVoucher (read): ${error.message}`)
  if (!data) return
  const { error: updateError } = await admin
    .from('vouchers')
    .update({ used_count: Math.max(data.used_count - count, 0) })
    .eq('id', voucherId)
  if (updateError) throw new Error(`releaseVoucher (update): ${updateError.message}`)
}

/** Đổi trạng thái đơn bằng service role (trigger vẫn chặn chuyển ngoài luồng): VD cửa hàng xác nhận đơn trong lúc khách đang mở trang */
export async function setOrderStatus(orderId: number, status: Database['public']['Enums']['order_status']) {
  const { error } = await adminClient().from('orders').update({ status }).eq('id', orderId)
  if (error) throw new Error(`setOrderStatus: ${error.message}`)
}

const HIDDEN_BOOK_SLUG = 'e2e-hidden-'

/** Sách ẩn (is_active = false) tạm cho test BOOK_UNAVAILABLE: không bao giờ hiện ra catalog công khai */
export async function createHiddenBook(): Promise<E2eBook> {
  const suffix = random()
  const { data, error } = await adminClient()
    .from('books')
    .insert({ title: `Sách ẩn E2E ${suffix}`, slug: `${HIDDEN_BOOK_SLUG}${suffix}`, price: 50_000, stock: 10, is_active: false })
    .select('id, slug, title, price, stock')
    .single()
  if (error) throw new Error(`createHiddenBook: ${error.message}`)
  return data
}

/** Xóa sách ẩn của e2e (cart_items xóa theo cascade); không truyền id → xóa mọi sách ẩn còn sót */
export async function deleteHiddenBooks(id?: number) {
  let query = adminClient().from('books').delete().like('slug', `${HIDDEN_BOOK_SLUG}%`).eq('is_active', false)
  if (id !== undefined) query = query.eq('id', id)
  const { error } = await query
  if (error) throw new Error(`deleteHiddenBooks: ${error.message}`)
}

/** Client anon đã đăng nhập bằng user e2e: gọi RPC như trình duyệt của chính user đó (RLS, auth.uid()) */
export async function signedInClient(user: { email: string; password: string }) {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  if (error) throw new Error(`signInWithPassword: ${error.message}`)
  return client
}

// ---------- Admin (Phase 7) ----------

/** Tiền tố slug của mọi sách / danh mục / tác giả do test admin tạo; cleanupE2eAdminData dọn theo tiền tố này */
export const E2E_ADMIN_SLUG = 'e2e-admin-'
/** Tiền tố mã voucher test admin (mã luôn viết HOA) */
export const E2E_ADMIN_VOUCHER = 'E2E-ADMIN-'
const COVER_BUCKET = 'book-covers'

export const e2eAdminSlug = () => `${E2E_ADMIN_SLUG}${random()}`

export async function makeAdmin(userId: string) {
  const { error } = await adminClient().from('profiles').update({ role: 'admin' }).eq('id', userId)
  if (error) throw new Error(`makeAdmin: ${error.message}`)
}

export type E2eCategory = { id: number; slug: string; name: string }

/** Danh mục test. Gốc ẩn + con đang hiện: con có trang danh mục nhưng không lên menu (menu chỉ đi từ danh mục gốc). */
export async function createE2eCategory({
  parentId = null,
  active = true,
}: { parentId?: number | null; active?: boolean } = {}): Promise<E2eCategory> {
  const slug = e2eAdminSlug()
  const { data, error } = await adminClient()
    .from('categories')
    .insert({ name: `E2E danh mục ${slug.slice(-6)}`, slug, parent_id: parentId, is_active: active })
    .select('id, slug, name')
    .single()
  if (error) throw new Error(`createE2eCategory: ${error.message}`)
  return data
}

export type E2eAdminBook = E2eBook & { category_id: number | null }

/** Sách test đang bán (mặc định) trong danh mục test; không có ISBN, không bìa */
export async function createE2eBook({
  categoryId,
  price = 80_000,
  stock = 10,
  active = true,
}: {
  categoryId: number
  price?: number
  stock?: number
  active?: boolean
}): Promise<E2eAdminBook> {
  const slug = e2eAdminSlug()
  const { data, error } = await adminClient()
    .from('books')
    .insert({ title: `E2E sách ${slug.slice(-6)}`, slug, category_id: categoryId, price, stock, is_active: active })
    .select('id, slug, title, price, stock, category_id')
    .single()
  if (error) throw new Error(`createE2eBook: ${error.message}`)
  return data
}

export async function createE2eAuthor() {
  const slug = e2eAdminSlug()
  const { data, error } = await adminClient()
    .from('authors')
    .insert({ name: `E2E tác giả ${slug.slice(-6)}`, slug })
    .select('id, slug, name')
    .single()
  if (error) throw new Error(`createE2eAuthor: ${error.message}`)
  return data
}

export async function linkAuthor(bookId: number, authorId: number) {
  const { error } = await adminClient().from('book_authors').insert({ book_id: bookId, author_id: authorId })
  if (error) throw new Error(`linkAuthor: ${error.message}`)
}

export async function unlinkAuthor(bookId: number, authorId: number) {
  const { error } = await adminClient().from('book_authors').delete().eq('book_id', bookId).eq('author_id', authorId)
  if (error) throw new Error(`unlinkAuthor: ${error.message}`)
}

/** Dòng sách đọc bằng service role (thấy cả sách ẩn) */
export async function bookRow(id: number) {
  const { data, error } = await adminClient()
    .from('books')
    .select('id, slug, title, price, stock, sold_count, cover_url, is_active, category_id, book_authors(author_id, role)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`bookRow: ${error.message}`)
  return data
}

/** Public URL của bucket bìa (kết thúc bằng /), để suy ra đường dẫn object từ cover_url */
export function coverPublicBase() {
  return adminClient().storage.from(COVER_BUCKET).getPublicUrl('').data.publicUrl
}

/** Upload sẵn một bìa WebP cho sách test (giả lập bìa cũ), ghi cover_url; trả về đường dẫn object */
export async function seedCover(bookId: number, webp: Buffer) {
  const admin = adminClient()
  const path = `${E2E_ADMIN_SLUG}${bookId}-${random()}.webp`
  const { error } = await admin.storage.from(COVER_BUCKET).upload(path, webp, { contentType: 'image/webp' })
  if (error) throw new Error(`seedCover (upload): ${error.message}`)
  const url = admin.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl
  const { error: updateError } = await admin.from('books').update({ cover_url: url }).eq('id', bookId)
  if (updateError) throw new Error(`seedCover (update): ${updateError.message}`)
  return path
}

/** Object còn trong bucket không */
export async function coverExists(path: string) {
  const { error } = await adminClient().storage.from(COVER_BUCKET).download(path)
  return !error
}

/** Tải object về (kiểm tra kích thước / định dạng ảnh đã xử lý) */
export async function downloadCover(path: string) {
  const { data, error } = await adminClient().storage.from(COVER_BUCKET).download(path)
  if (error) throw new Error(`downloadCover: ${error.message}`)
  return Buffer.from(await data.arrayBuffer())
}

/**
 * Xóa dữ liệu admin e2e + bìa trong Storage của sách test (đọc cover_url).
 * - Không truyền `slugs`: mọi sách / danh mục / tác giả slug e2e-admin-… và voucher E2E-ADMIN-… (setup, teardown: dọn
 *   phần sót khi lần chạy trước bị ngắt).
 * - Có `slugs`: chỉ các dòng đó (sau mỗi test: trên CI spec admin khác chạy song song, không được xóa dữ liệu của nhau).
 * Đơn của user e2e phải được xóa trước (deleteE2eUsers / cancelAndDeleteOrders) để hoàn kho đúng.
 */
export async function cleanupE2eAdminData(slugs?: string[]) {
  const admin = adminClient()
  // Bộ lọc slug dùng chung cho các bảng: đúng các slug được truyền, hoặc mọi slug có tiền tố e2e-admin-
  const [operator, value] = slugs ? ['in', `(${slugs.map((slug) => `"${slug}"`).join(',')})`] : ['like', `${E2E_ADMIN_SLUG}%`]
  const { data: books, error } = await admin.from('books').select('cover_url').filter('slug', operator, value)
  if (error) throw new Error(`cleanupE2eAdminData (books): ${error.message}`)

  const base = coverPublicBase()
  const paths = books.flatMap(({ cover_url }) =>
    cover_url?.startsWith(base) ? [decodeURIComponent(cover_url.slice(base.length))] : [],
  )
  if (paths.length > 0) {
    const { error: removeError } = await admin.storage.from(COVER_BUCKET).remove(paths)
    if (removeError) throw new Error(`cleanupE2eAdminData (covers): ${removeError.message}`)
  }

  // Tuần tự, không Promise.all: xóa sách và tác giả cùng lúc cùng cascade vào book_authors (trigger của nó cập nhật
  // books) → Postgres báo deadlock. Sách trước danh mục: danh mục bị xóa trước thì chỉ thừa bước set null.
  const deletions = [
    () => admin.from('books').delete().filter('slug', operator, value),
    () => admin.from('authors').delete().filter('slug', operator, value),
    () => admin.from('categories').delete().filter('slug', operator, value),
    ...(slugs ? [] : [() => admin.from('vouchers').delete().like('code', `${E2E_ADMIN_VOUCHER}%`)]),
  ]
  for (const deletion of deletions) {
    const { error: deleteError } = await deletion()
    if (deleteError) throw new Error(`cleanupE2eAdminData: ${deleteError.message}`)
  }
}
