/**
 * Tài khoản test cho e2e (Playwright setup/teardown + test đặt lại mật khẩu). Chạy local, không import vào src/.
 *
 * Chỉ chạy trên Supabase local (scripts/e2e-env.ts: khóa lấy từ `supabase status`, từ chối production / host cloud):
 *   publishable key — kiểm tra refresh token / đăng nhập như một client bình thường
 *   service role    — admin API: tạo / xóa user, sinh link đặt lại mật khẩu (không gửi email)
 *
 * Email luôn có dạng e2e+<random>[-<nhãn>]@example.com; cleanupE2eUsers() xóa mọi user khớp mẫu này
 * (user còn sót khi lần chạy trước bị ngắt).
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes, randomUUID } from 'node:crypto'
import type { Database } from '../src/types/database'
import { loadLocalSupabase } from './e2e-env'

export type E2eUser = { id: string; email: string; password: string; fullName: string }

const E2E_EMAIL = /^e2e\+[a-z0-9-]+@example\.com$/

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

function adminClient() {
  const { url, serviceRoleKey } = loadLocalSupabase()
  return createClient<Database>(url, serviceRoleKey, clientOptions)
}

/** Client anon chưa đăng nhập (RLS / policy Storage như khách); signedInClient đăng nhập trên client này */
export function anonClient() {
  const { url, publishableKey } = loadLocalSupabase()
  return createClient<Database>(url, publishableKey, clientOptions)
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
  await Promise.all([deleteHiddenBooks(), cleanupE2eAdminData(), deleteShopBooks()])
  return stale.length
}

/**
 * Dọn theo thứ tự khóa ngoại restrict của chợ sách cũ: khoản trả người bán (của user là người bán) → đơn của user (hủy
 * để hoàn tồn kho, kèm khoản trả của đơn đó) → tin sách cũ của user (kèm mọi đơn của người khác chứa tin: khóa
 * restrict) → ảnh trong thư mục của user (service role) → user.
 */
export async function deleteE2eUsers(ids: string[]) {
  if (ids.length === 0) return
  await deleteSellerPayouts('seller_id', ids)
  await cancelAndDeleteOrders(ids)
  await deleteUsedListings('seller_id', ids)
  await removeUsedPhotoFolders(ids)
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

/** id của user theo email (user tự đăng ký qua UI trong test, cần xóa ở finally); null nếu chưa có */
export async function findUserIdByEmail(email: string) {
  const admin = adminClient()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const user = data.users.find((candidate) => candidate.email === email)
    if (user) return user.id
    if (data.users.length < 1000) return null
  }
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
  const { data: orders, error } = await admin.from('orders').select('id').in('user_id', userIds)
  if (error) throw new Error(`cancelAndDeleteOrders (read): ${error.message}`)
  await deleteOrders(
    admin,
    orders.map((order) => order.id),
  )
}

type AdminClient = ReturnType<typeof adminClient>

/** Xóa đúng các đơn theo id, hoàn kho như cancelAndDeleteOrders (dùng chung cho đơn của user và đơn chứa tin sách cũ) */
async function deleteOrders(admin: AdminClient, orderIds: readonly number[]) {
  if (orderIds.length === 0) return
  // seller_payouts.order_id là on delete restrict: khoản trả người bán của đơn phải xóa trước đơn
  await deleteSellerPayouts('order_id', orderIds)
  await deleteDeliveredOrders(admin, orderIds)
  const { error: cancelError } = await admin
    .from('orders')
    .update({ status: 'cancelled', cancelled_reason: 'e2e cleanup' })
    .in('id', orderIds)
    .in('status', ['pending', 'confirmed', 'shipping'])
  if (cancelError) throw new Error(`deleteOrders (cancel): ${cancelError.message}`)
  const { error } = await admin.from('orders').delete().in('id', orderIds)
  if (error) throw new Error(`deleteOrders (delete): ${error.message}`)
}

/**
 * Đơn delivered: đọc dòng sách → xóa đơn → cộng lại stock, trừ sold_count (không âm), giảm used_count của voucher, như
 * trigger làm khi hủy. Thứ tự "đọc → xóa → hoàn kho": lỗi giữa chừng thì thiếu hoàn kho chứ không hoàn hai lần khi
 * chạy lại. Dòng sách cũ (used_listing_id) không trừ kho khi đặt → không hoàn (như trigger).
 */
async function deleteDeliveredOrders(admin: AdminClient, orderIds: readonly number[]) {
  const { data: orders, error } = await admin
    .from('orders')
    .select('id, voucher_id, order_items(book_id, quantity)')
    .in('id', orderIds)
    .eq('status', 'delivered')
    // Lọc dòng của bảng nhúng (không lọc đơn): chỉ lấy dòng sách mới
    .is('order_items.used_listing_id', null)
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
  const admin = adminClient()
  let read = admin.from('books').select('id').like('slug', `${HIDDEN_BOOK_SLUG}%`).eq('is_active', false)
  if (id !== undefined) read = read.eq('id', id)
  const { data: books, error: readError } = await read
  if (readError) throw new Error(`deleteHiddenBooks (read): ${readError.message}`)
  await deleteUsedListingsOfBooks(books.map((book) => book.id))
  let query = admin.from('books').delete().like('slug', `${HIDDEN_BOOK_SLUG}%`).eq('is_active', false)
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

type SignedInClient = Awaited<ReturnType<typeof signedInClient>>

/**
 * User đặt một đơn qua RPC place_order (như trình duyệt của chính user đó): giỏ chỉ có `quantity` cuốn sách
 * `bookId`, giao tới `addressId`, mặc định COD. Trả về dòng đơn.
 */
export async function placeE2eOrder(
  client: SignedInClient,
  userId: string,
  {
    addressId,
    bookId,
    quantity,
    paymentMethod = 'cod',
  }: { addressId: number; bookId: number; quantity: number; paymentMethod?: Database['public']['Enums']['payment_method'] },
) {
  await clearCart(userId)
  await setCartItem(userId, bookId, quantity)
  const { data, error } = await client.rpc('place_order', {
    p_address_id: addressId,
    p_payment_method: paymentMethod,
    p_idempotency_key: randomUUID(),
  })
  if (error || !data) throw new Error(`place_order: ${error?.message}`)
  return data
}

/** Cửa hàng giao đơn: đi đúng luồng trigger cho phép (pending → confirmed → shipping → delivered) */
export async function deliverOrder(orderId: number) {
  for (const status of ['confirmed', 'shipping', 'delivered'] as const) await setOrderStatus(orderId, status)
}

/** Ghi trạng thái thanh toán bằng service role (giả lập cửa hàng đã đối soát chuyển khoản) */
export async function setPaymentStatus(orderId: number, status: Database['public']['Enums']['payment_status']) {
  const { error } = await adminClient().from('orders').update({ payment_status: status }).eq('id', orderId)
  if (error) throw new Error(`setPaymentStatus: ${error.message}`)
}

export async function orderRow(orderId: number) {
  const { data, error } = await adminClient()
    .from('orders')
    .select('id, status, payment_method, payment_status, voucher_code, discount, total')
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw new Error(`orderRow: ${error.message}`)
  return data
}

/** Đánh giá của một sách (service role); `insertReview` tạo sẵn đánh giá cho test kiểm duyệt (bỏ qua RLS "đã mua") */
export async function reviewsOf(bookId: number) {
  const { data, error } = await adminClient()
    .from('reviews')
    .select('id, user_id, rating, content')
    .eq('book_id', bookId)
    .order('id')
  if (error) throw new Error(`reviewsOf: ${error.message}`)
  return data
}

export async function insertReview(bookId: number, userId: string, rating: number, content: string) {
  const { data, error } = await adminClient()
    .from('reviews')
    .insert({ book_id: bookId, user_id: userId, rating, content })
    .select('id')
    .single()
  if (error) throw new Error(`insertReview: ${error.message}`)
  return data
}

// ---------- Sách e2e cho đặt hàng (Phase 10) ----------

/** Tiền tố slug sách / danh mục mà checkout.spec, orders.spec đặt hàng lên (không đổi tồn kho của sách thật) */
export const E2E_SHOP_SLUG = 'e2e-shop-'

export type ShopBooks = { low: E2eBook[]; regular: E2eBook[]; plenty: E2eBook[]; medium: E2eBook[] }

/**
 * Bộ sách riêng của một project (setup gọi, mỗi project một bộ → chạy song song trên CI không giẫm tồn kho của nhau):
 * danh mục gốc ẩn + con đang hiện (không lên menu, không lên sitemap), sách đang bán, `created_at` lùi về 2000 để không
 * lên kệ "Mới về". low: tồn 4 (test vượt tồn kho), regular: tồn 60, plenty: tồn 200 (nhiều đơn), medium: tồn 40
 * (đặt tới khi còn 3 rồi hủy).
 */
export async function createShopBooks(label: string): Promise<ShopBooks> {
  const admin = adminClient()
  const slug = (part: string) => `${E2E_SHOP_SLUG}${label}-${part}-${random()}`
  const { data: root, error: rootError } = await admin
    .from('categories')
    .insert({ name: `E2E shop ${label}`, slug: slug('root'), is_active: false })
    .select('id')
    .single()
  if (rootError) throw new Error(`createShopBooks (root): ${rootError.message}`)
  const { data: leaf, error: leafError } = await admin
    .from('categories')
    .insert({ name: `E2E shop ${label} sách`, slug: slug('leaf'), parent_id: root.id })
    .select('id')
    .single()
  if (leafError) throw new Error(`createShopBooks (leaf): ${leafError.message}`)

  const specs = [
    ['low', 95_000, 4],
    ['low', 98_000, 4],
    ['regular', 120_000, 60],
    ['regular', 125_000, 60],
    ['plenty', 80_000, 200],
    ['medium', 90_000, 40],
  ] as const
  const kindOf = new Map<string, (typeof specs)[number][0]>()
  const rows = specs.map(([kind, price, stock]) => {
    const bookSlug = slug(kind)
    kindOf.set(bookSlug, kind)
    return { title: `E2E ${kind} ${bookSlug.slice(-6)}`, slug: bookSlug, category_id: leaf.id, price, stock, created_at: '2000-01-01T00:00:00Z' }
  })
  const { data, error } = await admin.from('books').insert(rows).select('id, slug, title, price, stock').order('id')
  if (error) throw new Error(`createShopBooks (books): ${error.message}`)
  const byKind = (kind: (typeof specs)[number][0]) => data.filter((book) => kindOf.get(book.slug) === kind)
  return { low: byKind('low'), regular: byKind('regular'), plenty: byKind('plenty'), medium: byKind('medium') }
}

/** Xóa mọi sách / danh mục e2e-shop (sau khi đơn của user e2e đã xóa): teardown và setup (phần sót của lần trước) */
export async function deleteShopBooks() {
  const admin = adminClient()
  const { data: books, error: readError } = await admin.from('books').select('id').like('slug', `${E2E_SHOP_SLUG}%`)
  if (readError) throw new Error(`deleteShopBooks (read): ${readError.message}`)
  await deleteUsedListingsOfBooks(books.map((book) => book.id))
  const { error } = await admin.from('books').delete().like('slug', `${E2E_SHOP_SLUG}%`)
  if (error) throw new Error(`deleteShopBooks (books): ${error.message}`)
  // Con trước gốc (parent_id không cascade)
  for (const isRoot of [false, true]) {
    let query = admin.from('categories').delete().like('slug', `${E2E_SHOP_SLUG}%`)
    query = isRoot ? query.is('parent_id', null) : query.not('parent_id', 'is', null)
    const { error: categoryError } = await query
    if (categoryError) throw new Error(`deleteShopBooks (categories): ${categoryError.message}`)
  }
}

// ---------- Admin (Phase 7) ----------

/** Tiền tố slug của mọi sách / danh mục / tác giả do test admin tạo; cleanupE2eAdminData dọn theo tiền tố này */
export const E2E_ADMIN_SLUG = 'e2e-admin-'
/** Tiền tố mã voucher test admin (mã luôn viết HOA) */
export const E2E_ADMIN_VOUCHER = 'E2E-ADMIN-'
const COVER_BUCKET = 'book-covers'

export const e2eAdminSlug = () => `${E2E_ADMIN_SLUG}${random()}`
/** Mã voucher test (≤ 30 ký tự, đúng dạng mã của form admin) */
export const e2eVoucherCode = () => `${E2E_ADMIN_VOUCHER}${random().toUpperCase()}`

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

/**
 * Sách test đang bán (mặc định) trong danh mục test; không có ISBN, không bìa. `created_at` lùi về 2000: không lên kệ
 * "Mới về" của trang chủ (sách bị xóa sau test mà kệ còn cache thì trang chủ prefetch link tới slug đã mất → 404).
 */
export async function createE2eBook({
  categoryId,
  price = 80_000,
  originalPrice = null,
  stock = 10,
  active = true,
  titleTag,
}: {
  /** null: sách không có danh mục (vẫn lên danh sách, docs/plans/sau-ux.md mục 6 ★6c) */
  categoryId: number | null
  price?: number
  /** Giá gốc (≥ price): trần giá của tin sách cũ */
  originalPrice?: number | null
  stock?: number
  active?: boolean
  /** Cụm thêm vào tên sách, VD `[mock:warn-self-harm]` điều khiển AI giả của gợi ý cảnh báo (features/warnings/mock.ts) */
  titleTag?: string
}): Promise<E2eAdminBook> {
  const slug = e2eAdminSlug()
  const { data, error } = await adminClient()
    .from('books')
    .insert({
      title: titleTag ? `E2E sách ${titleTag} ${slug.slice(-6)}` : `E2E sách ${slug.slice(-6)}`,
      slug,
      category_id: categoryId,
      price,
      original_price: originalPrice,
      stock,
      is_active: active,
      created_at: '2000-01-01T00:00:00Z',
    })
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

/**
 * Voucher test giảm 10% (service role); `usedCount` > 0 giả lập voucher đã có người dùng, `minOrderValue` để thử
 * VOUCHER_MIN_ORDER ở checkout; `isActive`, `startsAt`, `endsAt`, `usageLimit` để thử từng lý do mã không dùng được;
 * `isPublic` để thử gợi ý mã ở trang thanh toán.
 */
export async function createE2eVoucher({
  usedCount = 0,
  minOrderValue = 0,
  isActive = true,
  isPublic = false,
  startsAt = null,
  endsAt = null,
  usageLimit = null,
}: {
  usedCount?: number
  minOrderValue?: number
  isActive?: boolean
  isPublic?: boolean
  startsAt?: string | null
  endsAt?: string | null
  usageLimit?: number | null
} = {}) {
  const { data, error } = await adminClient()
    .from('vouchers')
    .insert({
      code: e2eVoucherCode(),
      discount_type: 'percent',
      discount_value: 10,
      used_count: usedCount,
      min_order_value: minOrderValue,
      is_active: isActive,
      is_public: isPublic,
      starts_at: startsAt,
      ends_at: endsAt,
      usage_limit: usageLimit,
    })
    .select('id, code')
    .single()
  if (error) throw new Error(`createE2eVoucher: ${error.message}`)
  return data
}

export async function voucherRow(code: string) {
  const { data, error } = await adminClient()
    .from('vouchers')
    .select('id, code, discount_type, discount_value, max_discount, min_order_value, starts_at, ends_at, is_active, is_public')
    .eq('code', code)
    .maybeSingle()
  if (error) throw new Error(`voucherRow: ${error.message}`)
  return data
}

/** Xóa đúng các voucher test của spec (teardown không tham số của cleanupE2eAdminData xóa mọi E2E-ADMIN-…) */
export async function deleteE2eVouchers(codes: string[]) {
  if (codes.length === 0) return
  const { error } = await adminClient().from('vouchers').delete().in('code', codes)
  if (error) throw new Error(`deleteE2eVouchers: ${error.message}`)
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

/** Sách theo slug (service role, thấy cả sách ẩn); không có → throw (thiếu dữ liệu là lỗi, không skip) */
export async function bookBySlug(slug: string) {
  const { data, error } = await adminClient()
    .from('books')
    .select('id, slug, title, price, original_price, is_active, category_id')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(`bookBySlug: ${error.message}`)
  if (!data) throw new Error(`bookBySlug: không có sách ${slug}`)
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
  const { data: books, error } = await admin.from('books').select('id, cover_url').filter('slug', operator, value)
  if (error) throw new Error(`cleanupE2eAdminData (books): ${error.message}`)
  // used_listings.book_id là on delete restrict: tin sách cũ (+ khoản trả, ảnh) của sách test xóa trước sách
  await deleteUsedListingsOfBooks(books.map((book) => book.id))

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

// ---------- Kiểm tra dọn dẹp ----------

/**
 * Dữ liệu e2e còn trong DB (sau khi đo tốc độ trên production / sau teardown): user email e2e+…, sách / danh mục /
 * tác giả slug e2e-…, voucher E2E-…, đơn của user e2e (đơn mồ côi user_id null không đếm được ở đây).
 */
export async function e2eLeftovers() {
  const admin = adminClient()
  const users: string[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    users.push(...data.users.filter((user) => E2E_EMAIL.test(user.email ?? '')).map((user) => user.id))
    if (data.users.length < 1000) break
  }
  const count = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>, label: string) => {
    const { count: total, error } = await query
    if (error) throw new Error(`e2eLeftovers (${label}): ${error.message}`)
    return total ?? 0
  }
  const [books, categories, authors, vouchers, orders] = await Promise.all([
    count(admin.from('books').select('id', { count: 'exact', head: true }).like('slug', 'e2e-%'), 'books'),
    count(admin.from('categories').select('id', { count: 'exact', head: true }).like('slug', 'e2e-%'), 'categories'),
    count(admin.from('authors').select('id', { count: 'exact', head: true }).like('slug', 'e2e-%'), 'authors'),
    count(admin.from('vouchers').select('id', { count: 'exact', head: true }).like('code', 'E2E-%'), 'vouchers'),
    users.length === 0
      ? Promise.resolve(0)
      : count(admin.from('orders').select('id', { count: 'exact', head: true }).in('user_id', users), 'orders'),
  ])
  return { users: users.length, books, categories, authors, vouchers, orders }
}

// ---------- Chợ sách cũ (cho-sach-cu) ----------

export const USED_PHOTO_BUCKET = 'used-listing-photos'

/** Tin sách cũ đọc bằng service role (thấy mọi trạng thái); null nếu không có */
export async function usedListingRow(id: number) {
  const { data, error } = await adminClient()
    .from('used_listings')
    .select('id, status, price, fee, seller_name, description, reject_reason, approved_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`usedListingRow: ${error.message}`)
  return data
}

/**
 * `updated_at` của tin (service role), nguyên chuỗi PostgREST trả về: gửi lại vào `p_expected_updated_at` của
 * review_used_listing / place_used_order như trang admin / trang mua (không qua Date: mất micro giây → luôn lệch)
 */
export async function usedListingUpdatedAt(id: number) {
  const { data, error } = await adminClient().from('used_listings').select('updated_at').eq('id', id).maybeSingle()
  if (error) throw new Error(`usedListingUpdatedAt: ${error.message}`)
  if (!data) throw new Error(`usedListingUpdatedAt: không có tin ${id}`)
  return data.updated_at
}

/** Mọi tin sách cũ của một người bán, mới nhất trước (service role, thấy mọi trạng thái) */
export async function usedListingsOf(sellerId: string) {
  const { data, error } = await adminClient()
    .from('used_listings')
    .select('id, status, price, fee, condition, description, photos')
    .eq('seller_id', sellerId)
    .order('id', { ascending: false })
  if (error) throw new Error(`usedListingsOf: ${error.message}`)
  return data
}

/** Tải một ảnh sách cũ bằng service role (bỏ qua policy đọc) để kiểm định dạng / metadata */
export async function downloadUsedPhoto(path: string) {
  const { data, error } = await adminClient().storage.from(USED_PHOTO_BUCKET).download(path)
  if (error) throw new Error(`downloadUsedPhoto: ${error.message}`)
  return Buffer.from(await data.arrayBuffer())
}

/** Khoản trả người bán của một tin (service role) */
export async function sellerPayoutsOf(listingId: number) {
  const { data, error } = await adminClient()
    .from('seller_payouts')
    .select('id, order_id, seller_id, price, fee, amount, status, paid_at')
    .eq('listing_id', listingId)
    .order('id')
  if (error) throw new Error(`sellerPayoutsOf: ${error.message}`)
  return data
}

/** Khoản trả người bán (sổ tiền restrict: phải xóa trước đơn, tin, user) theo người bán / đơn / tin */
async function deleteSellerPayouts(column: 'seller_id' | 'order_id' | 'listing_id', values: readonly (string | number)[]) {
  if (values.length === 0) return
  const { error } = await adminClient().from('seller_payouts').delete().in(column, values)
  if (error) throw new Error(`deleteSellerPayouts: ${error.message}`)
}

/**
 * Tin sách cũ theo người bán / sách: đơn chứa tin (+ khoản trả của đơn) → khoản trả của tin → tin → ảnh của tin trong
 * bucket. order_items.used_listing_id là on delete restrict và orders.user_id là on delete set null (đơn còn khi người
 * mua đã bị xóa) → tìm đơn theo tin, không theo user; mọi đơn (kể cả đã hủy, của người mua bất kỳ) xóa trước tin.
 * Ảnh xóa bằng client service role: policy xóa chặn client người dùng với ảnh của tin chờ duyệt / đã duyệt / đã bán.
 */
async function deleteUsedListings(column: 'id' | 'seller_id' | 'book_id', values: readonly (string | number)[]) {
  if (values.length === 0) return
  const used = adminClient()
  const { data: listings, error } = await used.from('used_listings').select('id, photos').in(column, values)
  if (error) throw new Error(`deleteUsedListings (read): ${error.message}`)
  if (listings.length === 0) return

  const ids = listings.map((listing) => listing.id)
  const { data: items, error: itemsError } = await used.from('order_items').select('order_id').in('used_listing_id', ids)
  if (itemsError) throw new Error(`deleteUsedListings (orders): ${itemsError.message}`)
  await deleteOrders(used, [...new Set(items.map((item) => item.order_id))])
  await deleteSellerPayouts('listing_id', ids)
  const { error: deleteError } = await used.from('used_listings').delete().in('id', ids)
  if (deleteError) throw new Error(`deleteUsedListings (delete): ${deleteError.message}`)

  const photos = [...new Set(listings.flatMap((listing) => listing.photos))]
  if (photos.length === 0) return
  const { error: removeError } = await used.storage.from(USED_PHOTO_BUCKET).remove(photos)
  if (removeError) throw new Error(`deleteUsedListings (photos): ${removeError.message}`)
}

/** used_listings.book_id là on delete restrict: gọi trước khi xóa sách test */
function deleteUsedListingsOfBooks(bookIds: readonly number[]) {
  return deleteUsedListings('book_id', bookIds)
}

/** Xóa một tin (+ đơn, khoản trả, ảnh) bằng service role: giả lập tin bị xóa ở nơi khác khi admin đang mở trang */
export function deleteUsedListingAsService(id: number) {
  return deleteUsedListings('id', [id])
}

/** Ảnh còn trong bucket không (service role, bỏ qua policy đọc) */
export async function usedPhotoExists(path: string) {
  const slash = path.lastIndexOf('/')
  const name = path.slice(slash + 1)
  const { data, error } = await adminClient()
    .storage.from(USED_PHOTO_BUCKET)
    .list(path.slice(0, slash), { search: name })
  if (error) throw new Error(`usedPhotoExists: ${error.message}`)
  return data.some((file) => file.name === name)
}

/** Xóa một ảnh bằng service role (giả lập ảnh mất ngoài policy: xóa tay trong Storage) */
export async function removeUsedPhotoAsService(path: string) {
  const { data, error } = await adminClient().storage.from(USED_PHOTO_BUCKET).remove([path])
  if (error) throw new Error(`removeUsedPhotoAsService: ${error.message}`)
  if (data.length !== 1) throw new Error(`removeUsedPhotoAsService: không có ảnh ${path}`)
}

/**
 * Xóa đúng các ảnh theo đường dẫn (service role): dọn ảnh một ca tải lên mà không đăng tin. Ảnh không còn thì bỏ qua
 * (không như removeUsedPhotoAsService) để gọi được trong finally.
 */
export async function removeUsedPhotosAsService(paths: readonly string[]) {
  if (paths.length === 0) return
  const { error } = await adminClient().storage.from(USED_PHOTO_BUCKET).remove([...paths])
  if (error) throw new Error(`removeUsedPhotosAsService: ${error.message}`)
}

/** Tên các ảnh trong thư mục <user_id>/ của bucket ảnh sách cũ (service role, thấy cả ảnh chưa gắn tin) */
export async function usedPhotosIn(userId: string) {
  const { data, error } = await adminClient().storage.from(USED_PHOTO_BUCKET).list(userId, { limit: 1000 })
  if (error) throw new Error(`usedPhotosIn: ${error.message}`)
  return data.map((file) => `${userId}/${file.name}`)
}

/**
 * Tải sẵn `count` ảnh WebP vào thư mục <user_id>/ bằng service role (bỏ qua policy, kể cả trần 30 ảnh: policy đếm ảnh
 * theo thư mục) → giả lập người bán đã có sẵn ngần ấy ảnh. Trả đường dẫn các ảnh.
 */
export async function seedUsedPhotosAsService(userId: string, count: number, webp: Buffer) {
  const storage = adminClient().storage.from(USED_PHOTO_BUCKET)
  const paths = Array.from({ length: count }, () => `${userId}/${randomUUID()}.webp`)
  for (const path of paths) {
    const { error } = await storage.upload(path, webp, { contentType: 'image/webp' })
    if (error) throw new Error(`seedUsedPhotosAsService: ${error.message}`)
  }
  return paths
}

/** Xóa mọi ảnh trong thư mục <user_id>/ (service role): dọn sau test tải ảnh qua UI mà không đăng tin */
export function removeUsedPhotosOf(userId: string) {
  return removeUsedPhotoFolders([userId])
}

/** Đổi giá / giá gốc sách test bằng service role (VD hạ trần giá dưới giá tin chờ duyệt) */
export async function setBookPrices(bookId: number, prices: { price: number; originalPrice: number | null }) {
  const { error } = await adminClient()
    .from('books')
    .update({ price: prices.price, original_price: prices.originalPrice })
    .eq('id', bookId)
  if (error) throw new Error(`setBookPrices: ${error.message}`)
}

/** Mọi ảnh trong thư mục <user_id>/ của bucket ảnh sách cũ (cả ảnh đã tải lên mà chưa gắn tin nào) */
async function removeUsedPhotoFolders(userIds: readonly string[]) {
  const storage = adminClient().storage.from(USED_PHOTO_BUCKET)
  for (const id of userIds) {
    const { data, error } = await storage.list(id, { limit: 1000 })
    if (error) throw new Error(`removeUsedPhotoFolders (list): ${error.message}`)
    if (data.length === 0) continue
    const { error: removeError } = await storage.remove(data.map((file) => `${id}/${file.name}`))
    if (removeError) throw new Error(`removeUsedPhotoFolders (remove): ${removeError.message}`)
  }
}

// ---------- Sở thích + cảnh báo nội dung (so-thich-canh-bao) ----------

type UserBlockInsert = Database['public']['Tables']['user_blocks']['Insert']

/** Nhiều tác giả test trong một câu insert (service role) */
export async function createE2eAuthors(count: number) {
  const rows = Array.from({ length: count }, () => {
    const slug = e2eAdminSlug()
    return { name: `E2E tác giả ${slug.slice(-6)}`, slug }
  })
  const { data, error } = await adminClient().from('authors').insert(rows).select('id, slug, name')
  if (error) throw new Error(`createE2eAuthors: ${error.message}`)
  if (data.length !== count) throw new Error(`createE2eAuthors: tạo ${data.length}/${count} tác giả`)
  return data
}

/** Nhãn cảnh báo + thời điểm xét của sách, đọc bằng service role (chuỗi timestamptz nguyên văn của PostgREST) */
export async function bookWarnings(id: number) {
  const { data, error } = await adminClient()
    .from('books')
    .select('content_warnings, content_warnings_reviewed_at')
    .eq('id', id)
    .single()
  if (error) throw new Error(`bookWarnings: ${error.message}`)
  return data
}

/** Một gợi ý cảnh báo (service role); null nếu không có */
export async function warningSuggestionRow(id: number) {
  const { data, error } = await adminClient()
    .from('content_warning_suggestions')
    .select('id, book_id, labels, status, reviewed_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`warningSuggestionRow: ${error.message}`)
  return data
}

/** Gợi ý cảnh báo của một sách, cũ trước (service role) */
export async function warningSuggestionsOf(bookId: number) {
  const { data, error } = await adminClient()
    .from('content_warning_suggestions')
    .select('id, labels, status, reviewed_at')
    .eq('book_id', bookId)
    .order('id')
  if (error) throw new Error(`warningSuggestionsOf: ${error.message}`)
  return data
}

/** Thêm một gợi ý chờ duyệt bằng service role (không qua AI, không trừ lượt consume_warning_quota) → id */
export async function insertWarningSuggestion(bookId: number, labels: Database['public']['Enums']['content_warning'][]) {
  const { data, error } = await adminClient()
    .from('content_warning_suggestions')
    .insert({ book_id: bookId, labels, reason: 'Gợi ý e2e tạo bằng service role.', model: 'e2e' })
    .select('id')
    .single()
  if (error) throw new Error(`insertWarningSuggestion: ${error.message}`)
  return data.id
}

/** Id gợi ý cảnh báo lớn nhất hiện có (0 nếu chưa có): mốc để tìm gợi ý tạo sau đó */
export async function maxWarningSuggestionId() {
  const { data, error } = await adminClient()
    .from('content_warning_suggestions')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`maxWarningSuggestionId: ${error.message}`)
  return data?.id ?? 0
}

/** Gợi ý cảnh báo có id > `afterId` kèm slug sách (service role), theo id */
export async function warningSuggestionsAfter(afterId: number) {
  const { data, error } = await adminClient()
    .from('content_warning_suggestions')
    .select('id, book_id, status, books(slug)')
    .gt('id', afterId)
    .order('id')
  if (error) throw new Error(`warningSuggestionsAfter: ${error.message}`)
  return data
}

export async function deleteWarningSuggestions(ids: number[]) {
  if (ids.length === 0) return
  const { error } = await adminClient().from('content_warning_suggestions').delete().in('id', ids)
  if (error) throw new Error(`deleteWarningSuggestions: ${error.message}`)
}

/** [api] max_rows trong supabase/config.toml */
const LOCAL_MAX_ROWS = 1000

/**
 * Sách chưa xét (content_warnings_reviewed_at null) không có gợi ý chờ duyệt, theo id (service role). Tính trong bộ nhớ
 * từ hai query riêng, KHÔNG dùng anti-join của PostgREST (đó là thứ spec đang kiểm).
 */
export async function unreviewedBooksWithoutPending() {
  const admin = adminClient()
  const [books, pending] = await Promise.all([
    admin.from('books').select('id, slug').is('content_warnings_reviewed_at', null).order('id'),
    admin.from('content_warning_suggestions').select('book_id').eq('status', 'pending'),
  ])
  if (books.error) throw new Error(`unreviewedBooksWithoutPending (books): ${books.error.message}`)
  if (pending.error) throw new Error(`unreviewedBooksWithoutPending (gợi ý): ${pending.error.message}`)
  // max_rows của PostgREST local (supabase/config.toml) cắt lặng lẽ: chạm trần thì kết quả không đủ → báo lỗi
  if (books.data.length >= LOCAL_MAX_ROWS || pending.data.length >= LOCAL_MAX_ROWS) {
    throw new Error('unreviewedBooksWithoutPending: chạm max_rows của PostgREST, kết quả có thể thiếu')
  }
  const suggested = new Set(pending.data.map((row) => row.book_id))
  return books.data.filter((book) => !suggested.has(book.id))
}

/** Mục chặn của một user (service role, không qua RLS) */
export async function userBlocksOf(userId: string) {
  const { data, error } = await adminClient()
    .from('user_blocks')
    .select('id, user_id, kind, category_id, author_id, publisher_id, warning')
    .eq('user_id', userId)
    .order('id')
  if (error) throw new Error(`userBlocksOf: ${error.message}`)
  return data
}

/**
 * Thay toàn bộ mục chặn của user bằng `rows` (service role; trigger giới hạn vẫn chạy cho từng dòng). Các dòng khác
 * bộ khóa: supabase-js gửi hợp các khóa, khóa thiếu ở một dòng thành NULL (không lấy default) → chỉ bỏ trống cột nullable.
 */
export async function replaceUserBlocks(userId: string, rows: Omit<UserBlockInsert, 'user_id'>[]) {
  const admin = adminClient()
  const { error } = await admin.from('user_blocks').delete().eq('user_id', userId)
  if (error) throw new Error(`replaceUserBlocks (delete): ${error.message}`)
  if (rows.length === 0) return
  const { error: insertError } = await admin.from('user_blocks').insert(rows.map((row) => ({ ...row, user_id: userId })))
  if (insertError) throw new Error(`replaceUserBlocks (insert): ${insertError.message}`)
}

/**
 * Khóa chặn của một sách theo slug (service role): tên, danh mục, NXB, tác giả vai trò author (câu 9). Không có sách
 * → throw (thiếu dữ liệu là lỗi, không skip).
 */
export async function bookBlockTargets(slug: string) {
  const { data, error } = await adminClient()
    .from('books')
    .select('id, title, category_id, publisher_id, book_authors(role, author_id)')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(`bookBlockTargets: ${error.message}`)
  if (!data) throw new Error(`bookBlockTargets: không có sách ${slug}`)
  return {
    id: data.id,
    title: data.title,
    categoryId: data.category_id,
    publisherId: data.publisher_id,
    authorIds: data.book_authors.flatMap((ba) => (ba.role === 'author' ? [ba.author_id] : [])),
  }
}

/** id danh mục theo slug (service role); không có → throw */
export async function categoryIdBySlug(slug: string) {
  const { data, error } = await adminClient().from('categories').select('id').eq('slug', slug).maybeSingle()
  if (error) throw new Error(`categoryIdBySlug: ${error.message}`)
  if (!data) throw new Error(`categoryIdBySlug: không có danh mục ${slug}`)
  return data.id
}
