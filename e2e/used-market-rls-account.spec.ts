import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { z } from 'zod'
import {
  bookRow,
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  deliverOrder,
  makeAdmin,
  seedAddress,
  sellerPayoutsOf,
  USED_PHOTO_BUCKET,
  usedListingRow,
  usedMarketAnonClient,
  usedMarketClient,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'

// Chợ sách cũ phần 1 (docs/plans/cho-sach-cu.md): chỉ DB, không UI. Gọi thẳng PostgREST / Storage bằng supabase-js như
// trình duyệt của từng người: RLS, quyền cột, policy ảnh, RPC + trigger luồng trạng thái tin và đơn sách cũ.
// User (người bán, người bán thứ hai, người mua, người lạ, admin) + sách test tạo riêng mỗi lần chạy, xóa ở afterAll:
// desktop-account và mobile-account chạy song song không giẫm nhau. Client không gắn kiểu Database (types chưa có bảng
// mới tới khi tải artifact database-types của CI): dữ liệu đọc về parse bằng zod.

test.describe.configure({ mode: 'serial' })

type Client = Awaited<ReturnType<typeof usedMarketClient>>

const SHIPPING_FEE = 30_000
const BOOK_PRICE = 100_000
const ORIGINAL_PRICE = 120_000

let seller: E2eUser
let seller2: E2eUser
let buyer: E2eUser
let stranger: E2eUser
let admin: E2eUser
let book: E2eAdminBook
const slugs: string[] = []
let sellerClient: Client
let seller2Client: Client
let buyerClient: Client
let strangerClient: Client
let adminClient: Client
let anon: Client

test.beforeAll(async () => {
  test.setTimeout(60_000)
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  book = await createE2eBook({ categoryId: leaf.id, price: BOOK_PRICE, originalPrice: ORIGINAL_PRICE, stock: 10 })
  slugs.push(book.slug)
  ;[seller, seller2, buyer, stranger, admin] = await Promise.all([
    createE2eUser('used-seller'),
    createE2eUser('used-seller2'),
    createE2eUser('used-buyer'),
    createE2eUser('used-stranger'),
    createE2eUser('used-admin'),
  ])
  await makeAdmin(admin.id)
  anon = usedMarketAnonClient()
  ;[sellerClient, seller2Client, buyerClient, strangerClient, adminClient] = await Promise.all([
    usedMarketClient(seller),
    usedMarketClient(seller2),
    usedMarketClient(buyer),
    usedMarketClient(stranger),
    usedMarketClient(admin),
  ])
})

test.afterAll(async () => {
  // Thứ tự trong deleteE2eUsers: khoản trả người bán → đơn → tin → ảnh → user; sách test sau cùng (book_id restrict)
  const users = [seller, seller2, buyer, stranger, admin].filter((user) => user !== undefined)
  await deleteE2eUsers(users.map((user) => user.id))
  await cleanupE2eAdminData(slugs)
})

const photo = () => sharp({ create: { width: 60, height: 90, channels: 3, background: '#456' } })

/** Tải một ảnh WebP vào thư mục của chính user (đúng mẫu <uid>/<uuid>.webp); trả về đường dẫn */
async function uploadPhoto(client: Client, user: E2eUser) {
  const path = `${user.id}/${randomUUID()}.webp`
  const { error } = await client.storage
    .from(USED_PHOTO_BUCKET)
    .upload(path, await photo().webp().toBuffer(), { contentType: 'image/webp' })
  expect(error, path).toBeNull()
  return path
}

async function createListing(client: Client, photos: string[], price = 80_000) {
  const { data, error } = await client.rpc('create_used_listing', {
    p_book_id: book.id,
    p_condition: 'good',
    p_price: price,
    p_description: 'Sách còn mới, gáy hơi sờn.',
    p_photos: photos,
  })
  expect(error).toBeNull()
  return z.number().parse(data)
}

async function review(client: Client, id: number, expected: string, approve: boolean, reason: string | null = null) {
  return client.rpc('review_used_listing', {
    p_id: id,
    p_expected_status: expected,
    p_approve: approve,
    p_reason: reason,
  })
}

async function approve(id: number) {
  const { error } = await review(adminClient, id, 'pending', true)
  expect(error).toBeNull()
}

async function visibleIds(client: Client, id: number) {
  const { data, error } = await client.from('used_listings').select('id').eq('id', id)
  expect(error).toBeNull()
  return z.array(z.object({ id: z.number() })).parse(data).map((row) => row.id)
}

function placeUsedOrder(client: Client, listingId: number, addressId: number, key: string, expectedTotal: number) {
  return client.rpc('place_used_order', {
    p_listing_id: listingId,
    p_address_id: addressId,
    p_payment_method: 'cod',
    p_idempotency_key: key,
    p_expected_total: expectedTotal,
  })
}

const orderSchema = z.object({ id: z.number(), status: z.string(), subtotal: z.number(), shipping_fee: z.number(), total: z.number() })

test('phí sàn 10% làm tròn tới 1.000₫ (nửa làm tròn lên); chỉ thành viên đã đăng nhập hỏi được', async () => {
  const table: [number, number][] = [
    [1_000, 0],
    [4_999, 0],
    [5_000, 1_000],
    [15_000, 2_000],
    [25_000, 3_000],
    [98_000, 10_000],
    [105_000, 11_000],
    [1_234_567, 123_000],
  ]
  for (const [price, fee] of table) {
    const { data, error } = await sellerClient.rpc('used_listing_quote', { p_price: price })
    expect(error, String(price)).toBeNull()
    expect(z.array(z.object({ fee: z.number(), payout: z.number() })).parse(data), String(price)).toEqual([
      { fee, payout: price - fee },
    ])
  }
  expect((await sellerClient.rpc('used_listing_quote', { p_price: 0 })).error?.message).toBe('LISTING_PRICE_INVALID')
  expect((await anon.rpc('used_listing_quote', { p_price: 50_000 })).error).not.toBeNull()
})

test('không ghi thẳng bảng tin / sổ tiền; anon không đọc được seller_id', async () => {
  const path = await uploadPhoto(sellerClient, seller)
  const insert = await sellerClient
    .from('used_listings')
    .insert({ book_id: book.id, condition: 'good', price: 1_000, fee: 0, photos: [path], status: 'approved' })
  expect(insert.error?.message).toMatch(/permission denied/)

  const id = await createListing(sellerClient, [path])
  const update = await sellerClient.from('used_listings').update({ status: 'approved' }).eq('id', id)
  expect(update.error?.message).toMatch(/permission denied/)
  const remove = await sellerClient.from('used_listings').delete().eq('id', id)
  expect(remove.error?.message).toMatch(/permission denied/)
  expect((await usedListingRow(id))?.status).toBe('pending')

  const payout = await sellerClient.from('seller_payouts').insert({
    order_id: 1,
    listing_id: id,
    seller_id: seller.id,
    title: 'x',
    price: 1_000,
    fee: 0,
    amount: 1_000,
  })
  expect(payout.error?.message).toMatch(/permission denied/)
  const payoutUpdate = await adminClient.from('seller_payouts').update({ status: 'paid' }).gt('id', 0)
  expect(payoutUpdate.error?.message).toMatch(/permission denied/)

  const sellerId = await anon.from('used_listings').select('seller_id').limit(1)
  expect(sellerId.error?.message).toMatch(/permission denied/)
  const fee = await anon.from('used_listings').select('fee').limit(1)
  expect(fee.error?.message).toMatch(/permission denied/)
})

test('ảnh: chỉ ghi vào thư mục của mình, đúng mẫu tên, chỉ WebP', async () => {
  await uploadPhoto(sellerClient, seller)
  const webp = await photo().webp().toBuffer()
  const bucket = sellerClient.storage.from(USED_PHOTO_BUCKET)

  const otherFolder = await bucket.upload(`${buyer.id}/${randomUUID()}.webp`, webp, { contentType: 'image/webp' })
  expect(otherFolder.error).not.toBeNull()
  const badName = await bucket.upload(`${seller.id}/anh-bia.webp`, webp, { contentType: 'image/webp' })
  expect(badName.error).not.toBeNull()
  const nested = await bucket.upload(`${seller.id}/${randomUUID()}/${randomUUID()}.webp`, webp, { contentType: 'image/webp' })
  expect(nested.error).not.toBeNull()
  const png = await bucket.upload(`${seller.id}/${randomUUID()}.webp`, await photo().png().toBuffer(), {
    contentType: 'image/png',
  })
  expect(png.error).not.toBeNull()
  const pngName = await bucket.upload(`${seller.id}/${randomUUID()}.png`, await photo().png().toBuffer(), {
    contentType: 'image/png',
  })
  expect(pngName.error).not.toBeNull()
  const anonUpload = await anon.storage
    .from(USED_PHOTO_BUCKET)
    .upload(`${seller.id}/${randomUUID()}.webp`, webp, { contentType: 'image/webp' })
  expect(anonUpload.error).not.toBeNull()
})

test('đăng tin: giá trần, ảnh của người khác; tin + ảnh chờ duyệt chỉ người bán và admin thấy', async () => {
  const path = await uploadPhoto(sellerClient, seller)
  const create = (price: number, photos: string[]) =>
    sellerClient.rpc('create_used_listing', {
      p_book_id: book.id,
      p_condition: 'like_new',
      p_price: price,
      p_description: null,
      p_photos: photos,
    })

  const overCap = await create(ORIGINAL_PRICE + 1, [path])
  expect(overCap.error?.message).toBe('LISTING_PRICE_INVALID')
  expect(JSON.parse(overCap.error?.details ?? '{}')).toEqual({ max: ORIGINAL_PRICE })
  expect((await create(0, [path])).error?.message).toBe('LISTING_PRICE_INVALID')

  const strangerPhoto = await uploadPhoto(strangerClient, stranger)
  expect((await create(50_000, [strangerPhoto])).error?.message).toBe('LISTING_PHOTOS_INVALID')
  // Đúng mẫu tên nhưng chưa tải lên
  expect((await create(50_000, [`${seller.id}/${randomUUID()}.webp`])).error?.message).toBe('LISTING_PHOTOS_INVALID')
  expect((await create(50_000, [path, path])).error?.message).toBe('LISTING_PHOTOS_INVALID')
  expect((await create(50_000, [])).error?.message).toBe('LISTING_PHOTOS_INVALID')

  const atCap = await create(ORIGINAL_PRICE, [path])
  expect(atCap.error).toBeNull()
  const id = z.number().parse(atCap.data)
  expect(await usedListingRow(id)).toMatchObject({ status: 'pending', price: ORIGINAL_PRICE, fee: 12_000, seller_name: seller.fullName })

  expect(await visibleIds(anon, id)).toEqual([])
  expect(await visibleIds(strangerClient, id)).toEqual([])
  expect(await visibleIds(sellerClient, id)).toEqual([id])
  expect(await visibleIds(adminClient, id)).toEqual([id])

  for (const client of [anon, strangerClient]) {
    const bucket = client.storage.from(USED_PHOTO_BUCKET)
    expect((await bucket.createSignedUrl(path, 60)).error).not.toBeNull()
    expect((await bucket.download(path)).error).not.toBeNull()
  }
  expect((await sellerClient.storage.from(USED_PHOTO_BUCKET).createSignedUrl(path, 60)).error).toBeNull()
  expect((await adminClient.storage.from(USED_PHOTO_BUCKET).createSignedUrl(path, 60)).error).toBeNull()
})

test('duyệt / sửa / gỡ: chỉ admin, từ chối phải có lý do; tin đã duyệt công khai cả ảnh, sửa thì về chờ duyệt', async () => {
  const path = await uploadPhoto(sellerClient, seller)
  const id = await createListing(sellerClient, [path])

  expect((await review(sellerClient, id, 'pending', true)).error?.message).toBe('FORBIDDEN')
  expect((await review(adminClient, id, 'pending', false)).error?.message).toBe('INVALID_INPUT')
  expect((await review(adminClient, id, 'pending', false, '   ')).error?.message).toBe('INVALID_INPUT')
  expect((await review(adminClient, id, 'approved', true)).error?.message).toBe('LISTING_STATUS_CHANGED')

  await approve(id)
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved', reject_reason: null })
  expect(await visibleIds(anon, id)).toEqual([id])
  expect(await visibleIds(strangerClient, id)).toEqual([id])
  const signed = await anon.storage.from(USED_PHOTO_BUCKET).createSignedUrl(path, 60)
  expect(signed.error).toBeNull()
  const image = await fetch(z.string().parse(signed.data?.signedUrl))
  expect(image.status).toBe(200)
  expect(image.headers.get('content-type')).toBe('image/webp')

  // Người bán sửa tin đã duyệt → về chờ duyệt, phí tính lại, công khai không còn thấy
  const edit = await sellerClient.rpc('update_used_listing', {
    p_id: id,
    p_condition: 'fair',
    p_price: 25_000,
    p_description: 'Giảm giá',
    p_photos: [path],
  })
  expect(edit.error).toBeNull()
  expect(await usedListingRow(id)).toMatchObject({ status: 'pending', price: 25_000, fee: 3_000 })
  expect(await visibleIds(anon, id)).toEqual([])
  const editOther = await strangerClient.rpc('update_used_listing', {
    p_id: id,
    p_condition: 'fair',
    p_price: 25_000,
    p_description: null,
    p_photos: [path],
  })
  expect(editOther.error?.message).toBe('LISTING_NOT_EDITABLE')

  // Admin duyệt lại rồi gỡ (approved → rejected, kèm lý do)
  await approve(id)
  const takeDown = await review(adminClient, id, 'approved', false, 'Ảnh không đúng sách')
  expect(takeDown.error).toBeNull()
  expect(await usedListingRow(id)).toMatchObject({ status: 'rejected', reject_reason: 'Ảnh không đúng sách' })
  expect(await visibleIds(anon, id)).toEqual([])

  // Rút tin; tin đã rút không sửa / rút lại được
  expect((await sellerClient.rpc('withdraw_used_listing', { p_id: id })).error).toBeNull()
  expect((await sellerClient.rpc('withdraw_used_listing', { p_id: id })).error?.message).toBe('LISTING_NOT_EDITABLE')
  expect((await usedListingRow(id))?.status).toBe('withdrawn')
})

test('tối đa 10 tin chờ duyệt mỗi người', async () => {
  const path = await uploadPhoto(seller2Client, seller2)
  for (let i = 0; i < 10; i++) await createListing(seller2Client, [path], 10_000 + i * 1_000)
  const eleventh = await seller2Client.rpc('create_used_listing', {
    p_book_id: book.id,
    p_condition: 'worn',
    p_price: 9_000,
    p_description: null,
    p_photos: [path],
  })
  expect(eleventh.error?.message).toBe('LISTING_PENDING_LIMIT')
})

test('mua: không mua tin của mình, tổng lệch, cùng key cùng đơn, người thứ hai không mua được; hủy → tin về đang bán; giao + đã thanh toán → một khoản chờ trả', async () => {
  test.setTimeout(60_000)
  const path = await uploadPhoto(sellerClient, seller)
  const price = 98_000
  const id = await createListing(sellerClient, [path], price)
  await approve(id)
  const [sellerAddress, buyerAddress, strangerAddress] = await Promise.all([
    seedAddress(seller.id),
    seedAddress(buyer.id),
    seedAddress(stranger.id),
  ])
  const total = price + SHIPPING_FEE
  const before = await bookRow(book.id)

  const quote = await buyerClient.rpc('quote_used_order', { p_listing_id: id })
  expect(quote.error).toBeNull()
  expect(quote.data).toEqual([{ price, shipping_fee: SHIPPING_FEE, total, available: true }])

  expect((await placeUsedOrder(sellerClient, id, sellerAddress, randomUUID(), total)).error?.message).toBe('LISTING_OWN')
  const changed = await placeUsedOrder(buyerClient, id, buyerAddress, randomUUID(), total - 1)
  expect(changed.error?.message).toBe('LISTING_CHANGED')
  expect(JSON.parse(changed.error?.details ?? '{}')).toEqual({ total })
  const noKey = await buyerClient.rpc('place_used_order', {
    p_listing_id: id,
    p_address_id: buyerAddress,
    p_expected_total: total,
  })
  expect(noKey.error?.message).toBe('INVALID_INPUT')

  const key = randomUUID()
  const first = await placeUsedOrder(buyerClient, id, buyerAddress, key, total)
  expect(first.error).toBeNull()
  const order = orderSchema.parse(first.data)
  expect(order).toMatchObject({ status: 'pending', subtotal: price, shipping_fee: SHIPPING_FEE, total })
  const again = await placeUsedOrder(buyerClient, id, buyerAddress, key, total)
  expect(orderSchema.parse(again.data).id).toBe(order.id)
  expect((await usedListingRow(id))?.status).toBe('sold')
  expect((await placeUsedOrder(strangerClient, id, strangerAddress, randomUUID(), total)).error?.message).toBe(
    'LISTING_UNAVAILABLE',
  )
  // Tin đã bán vẫn công khai (trang chi tiết hiện "Đã bán"), không còn mua được
  expect(await visibleIds(anon, id)).toEqual([id])
  const soldQuote = await buyerClient.rpc('quote_used_order', { p_listing_id: id })
  expect(soldQuote.data).toEqual([{ price, shipping_fee: SHIPPING_FEE, total, available: false }])
  expect(await bookRow(book.id)).toMatchObject({ stock: before?.stock, sold_count: before?.sold_count })

  // Người mua hủy → tin về đang bán, tồn kho sách mới không đổi
  expect((await buyerClient.rpc('cancel_order', { p_order_id: order.id })).error).toBeNull()
  expect((await usedListingRow(id))?.status).toBe('approved')
  expect(await bookRow(book.id)).toMatchObject({ stock: before?.stock, sold_count: before?.sold_count })
  expect(await sellerPayoutsOf(id)).toEqual([])

  // Mua lại, cửa hàng giao COD (service role đi đúng luồng) → đã thanh toán → đúng một khoản = giá − phí
  const second = orderSchema.parse((await placeUsedOrder(buyerClient, id, buyerAddress, randomUUID(), total)).data)
  await deliverOrder(second.id)
  const payouts = await sellerPayoutsOf(id)
  expect(payouts).toHaveLength(1)
  expect(payouts[0]).toMatchObject({
    order_id: second.id,
    seller_id: seller.id,
    price,
    fee: 10_000,
    amount: price - 10_000,
    status: 'pending',
    paid_at: null,
  })
  expect((await usedListingRow(id))?.status).toBe('sold')
  expect(await bookRow(book.id)).toMatchObject({ stock: before?.stock, sold_count: before?.sold_count })

  // Người bán xem đơn đã bán: không có cột nào của người mua / mã đơn; đơn đã hủy không tính
  const sales = await sellerClient.rpc('my_used_sales')
  expect(sales.error).toBeNull()
  const rows = z.array(z.record(z.string(), z.unknown())).parse(sales.data)
  expect(rows).toHaveLength(1)
  expect(Object.keys(rows[0] ?? {}).sort()).toEqual(
    ['amount', 'fee', 'listing_id', 'order_status', 'payment_status', 'payout_status', 'price', 'sold_at', 'title'].sort(),
  )
  expect(rows[0]).toMatchObject({ listing_id: id, price, fee: 10_000, amount: price - 10_000, order_status: 'delivered', payout_status: 'pending' })
  expect(z.array(z.unknown()).parse((await buyerClient.rpc('my_used_sales')).data)).toEqual([])

  // Sổ tiền: người bán thấy khoản của mình, người mua không thấy; chỉ admin đánh dấu đã trả, một lần
  const payoutId = payouts[0]?.id ?? 0
  expect(await visibleRows(sellerClient, payoutId)).toEqual([payoutId])
  expect(await visibleRows(buyerClient, payoutId)).toEqual([])
  expect((await sellerClient.rpc('mark_payout_paid', { p_id: payoutId })).error?.message).toBe('FORBIDDEN')
  expect((await adminClient.rpc('mark_payout_paid', { p_id: payoutId })).error).toBeNull()
  expect((await sellerPayoutsOf(id))[0]).toMatchObject({ status: 'paid', paid_at: expect.any(String) })
  expect((await adminClient.rpc('mark_payout_paid', { p_id: payoutId })).error?.message).toBe('PAYOUT_STATUS_CHANGED')
})

async function visibleRows(client: Client, payoutId: number) {
  const { data, error } = await client.from('seller_payouts').select('id').eq('id', payoutId)
  expect(error).toBeNull()
  return z.array(z.object({ id: z.number() })).parse(data).map((row) => row.id)
}
