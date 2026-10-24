import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import {
  anonClient,
  bookRow,
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  deliverOrder,
  makeAdmin,
  removeUsedPhotoAsService,
  seedAddress,
  sellerPayoutsOf,
  setPaymentStatus,
  signedInClient,
  USED_PHOTO_BUCKET,
  usedListingRow,
  usedListingUpdatedAt,
  usedPhotoExists,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import type { Database } from '../src/types/database'

// Chợ sách cũ phần 1 (docs/plans/cho-sach-cu.md): chỉ DB, không UI. Gọi thẳng PostgREST / Storage bằng supabase-js như
// trình duyệt của từng người: RLS, quyền cột, policy ảnh, RPC + trigger luồng trạng thái tin và đơn sách cũ.
// User (người bán, người bán thứ hai, người mua, người lạ, admin) + sách test tạo riêng mỗi lần chạy, xóa ở afterAll:
// desktop-account và mobile-account chạy song song không giẫm nhau.

test.describe.configure({ mode: 'serial' })

type Client = ReturnType<typeof anonClient>
type ListingStatus = Database['public']['Enums']['used_listing_status']
type PaymentMethod = Database['public']['Enums']['payment_method']

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
  anon = anonClient()
  ;[sellerClient, seller2Client, buyerClient, strangerClient, adminClient] = await Promise.all([
    signedInClient(seller),
    signedInClient(seller2),
    signedInClient(buyer),
    signedInClient(stranger),
    signedInClient(admin),
  ])
})

test.afterAll(async () => {
  // Thứ tự trong deleteE2eUsers: khoản trả người bán → đơn → tin (kèm mọi đơn chứa tin) → ảnh → user; sách test sau
  // cùng (book_id restrict)
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
  if (error) throw new Error(`create_used_listing: ${error.message}`)
  return data
}

/**
 * review_used_listing như trang admin: trạng thái + updated_at của bản đang xem (mặc định: updated_at hiện tại của tin,
 * đọc bằng service role; `updatedAt` = bản cũ để thử tin vừa đổi)
 */
async function review(
  client: Client,
  id: number,
  expected: ListingStatus,
  approve: boolean,
  { reason, updatedAt }: { reason?: string; updatedAt?: string } = {},
) {
  return client.rpc('review_used_listing', {
    p_id: id,
    p_expected_status: expected,
    p_expected_updated_at: updatedAt ?? (await usedListingUpdatedAt(id)),
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
  if (error) throw new Error(`visibleIds: ${error.message}`)
  return data.map((row) => row.id)
}

/** place_used_order như trang mua: `updatedAt` = bản tin đang xem (mặc định: updated_at hiện tại của tin) */
async function placeUsedOrder(
  client: Client,
  listingId: number,
  addressId: number,
  key: string,
  expectedTotal: number,
  paymentMethod: PaymentMethod = 'cod',
  updatedAt?: string,
) {
  return client.rpc('place_used_order', {
    p_listing_id: listingId,
    p_address_id: addressId,
    p_expected_updated_at: updatedAt ?? (await usedListingUpdatedAt(listingId)),
    p_payment_method: paymentMethod,
    p_idempotency_key: key,
    p_expected_total: expectedTotal,
  })
}

/** Đơn vừa đặt (place_used_order thành công); RPC báo lỗi → test đỏ kèm mã lỗi */
async function placedOrder(request: ReturnType<typeof placeUsedOrder>) {
  const { data, error } = await request
  if (error) throw new Error(`place_used_order: ${error.message}`)
  return data
}

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
    expect(data, String(price)).toEqual([{ fee, payout: price - fee }])
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
  // Mô tả chỉ có dấu cách: RPC lưu null (nullif(btrim(…), ''); btrim mặc định chỉ cắt dấu cách)
  const create = (price: number, photos: string[]) =>
    sellerClient.rpc('create_used_listing', {
      p_book_id: book.id,
      p_condition: 'like_new',
      p_price: price,
      p_description: '   ',
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
  const noBook = await sellerClient.rpc('create_used_listing', {
    p_book_id: -1,
    p_condition: 'good',
    p_price: 50_000,
    p_description: '',
    p_photos: [path],
  })
  expect(noBook.error?.message).toBe('INVALID_INPUT')
  expect(JSON.parse(noBook.error?.details ?? '{}')).toEqual({ field: 'book_id' })

  const atCap = await create(ORIGINAL_PRICE, [path])
  if (atCap.error) throw new Error(`create_used_listing: ${atCap.error.message}`)
  const id = atCap.data
  expect(await usedListingRow(id)).toMatchObject({
    status: 'pending',
    price: ORIGINAL_PRICE,
    fee: 12_000,
    seller_name: seller.fullName,
    description: null,
  })

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
  expect((await review(adminClient, id, 'pending', false, { reason: '   ' })).error?.message).toBe('INVALID_INPUT')
  expect((await review(adminClient, id, 'approved', true)).error?.message).toBe('LISTING_STATUS_CHANGED')

  await approve(id)
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved', reject_reason: null })
  expect(await visibleIds(anon, id)).toEqual([id])
  expect(await visibleIds(strangerClient, id)).toEqual([id])
  const signed = await anon.storage.from(USED_PHOTO_BUCKET).createSignedUrl(path, 60)
  if (signed.error) throw new Error(`createSignedUrl: ${signed.error.message}`)
  const image = await fetch(signed.data.signedUrl)
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
  expect(await usedListingRow(id)).toMatchObject({
    status: 'pending',
    price: 25_000,
    fee: 3_000,
    description: 'Giảm giá',
  })
  expect(await visibleIds(anon, id)).toEqual([])
  // Sửa tiếp tin đang chờ duyệt với mô tả rỗng → lưu null
  const clearDescription = await sellerClient.rpc('update_used_listing', {
    p_id: id,
    p_condition: 'fair',
    p_price: 25_000,
    p_description: '   ',
    p_photos: [path],
  })
  expect(clearDescription.error).toBeNull()
  expect(await usedListingRow(id)).toMatchObject({ status: 'pending', description: null })
  const editOther = await strangerClient.rpc('update_used_listing', {
    p_id: id,
    p_condition: 'fair',
    p_price: 25_000,
    p_description: '',
    p_photos: [path],
  })
  expect(editOther.error?.message).toBe('LISTING_NOT_EDITABLE')

  // Admin duyệt lại rồi gỡ (approved → rejected, kèm lý do)
  await approve(id)
  const takeDown = await review(adminClient, id, 'approved', false, { reason: 'Ảnh không đúng sách' })
  expect(takeDown.error).toBeNull()
  expect(await usedListingRow(id)).toMatchObject({ status: 'rejected', reject_reason: 'Ảnh không đúng sách' })
  expect(await visibleIds(anon, id)).toEqual([])

  // Rút tin; tin đã rút không sửa / rút lại được
  expect((await sellerClient.rpc('withdraw_used_listing', { p_id: id })).error).toBeNull()
  expect((await sellerClient.rpc('withdraw_used_listing', { p_id: id })).error?.message).toBe('LISTING_NOT_EDITABLE')
  expect((await usedListingRow(id))?.status).toBe('withdrawn')
})

test('(r1) duyệt / từ chối với updated_at cũ (người bán vừa sửa tin) → LISTING_STATUS_CHANGED, tin không đổi', async () => {
  const path = await uploadPhoto(sellerClient, seller)
  const id = await createListing(sellerClient, [path])
  const stale = await usedListingUpdatedAt(id)
  // Người bán sửa tin đang chờ duyệt: trạng thái vẫn pending, chỉ nội dung + updated_at đổi
  const edit = await sellerClient.rpc('update_used_listing', {
    p_id: id,
    p_condition: 'worn',
    p_price: 80_000,
    p_description: 'Sửa sau khi admin mở tin',
    p_photos: [path],
  })
  expect(edit.error).toBeNull()
  const before = await usedListingRow(id)
  const current = await usedListingUpdatedAt(id)
  expect(before?.status).toBe('pending')
  expect(current).not.toBe(stale)

  for (const approve of [true, false]) {
    const result = await review(adminClient, id, 'pending', approve, { reason: 'Ảnh mờ', updatedAt: stale })
    expect(result.error?.message, String(approve)).toBe('LISTING_STATUS_CHANGED')
  }
  expect(await usedListingRow(id)).toEqual(before)
  expect(await usedListingUpdatedAt(id)).toBe(current)

  // Bản đang có (updated_at mới, nguyên chuỗi PostgREST) → duyệt được
  expect((await review(adminClient, id, 'pending', true, { updatedAt: current })).error).toBeNull()
  expect((await usedListingRow(id))?.status).toBe('approved')
})

test('ảnh gắn tin chờ duyệt / đã duyệt không xóa được, tên đã gắn tin không tải lại được; duyệt kiểm lại ảnh còn đủ', async () => {
  test.setTimeout(60_000)
  // Storage không báo lỗi khi policy chặn xóa (chỉ trả mảng rỗng) → kiểm ảnh còn / mất bằng service role
  const remove = (client: Client, path: string) => client.storage.from(USED_PHOTO_BUCKET).remove([path])

  const approvedPhoto = await uploadPhoto(sellerClient, seller)
  const approvedId = await createListing(sellerClient, [approvedPhoto])
  await approve(approvedId)
  await remove(sellerClient, approvedPhoto)
  await remove(strangerClient, approvedPhoto)
  expect(await usedPhotoExists(approvedPhoto)).toBe(true)
  expect((await anon.storage.from(USED_PHOTO_BUCKET).createSignedUrl(approvedPhoto, 60)).error).toBeNull()

  const pendingPhoto = await uploadPhoto(sellerClient, seller)
  await createListing(sellerClient, [pendingPhoto])
  await remove(sellerClient, pendingPhoto)
  expect(await usedPhotoExists(pendingPhoto)).toBe(true)

  // Ảnh chưa gắn tin: người bán xóa được (dọn ảnh tải lên bỏ dở)
  const loosePhoto = await uploadPhoto(sellerClient, seller)
  await remove(sellerClient, loosePhoto)
  expect(await usedPhotoExists(loosePhoto)).toBe(false)

  // Tin đã rút: xóa được ảnh, nhưng tải lại đúng tên đó bị chặn (không đổi được ảnh của tin)
  const withdrawnPhoto = await uploadPhoto(sellerClient, seller)
  const withdrawnId = await createListing(sellerClient, [withdrawnPhoto])
  expect((await sellerClient.rpc('withdraw_used_listing', { p_id: withdrawnId })).error).toBeNull()
  await remove(sellerClient, withdrawnPhoto)
  expect(await usedPhotoExists(withdrawnPhoto)).toBe(false)
  const reupload = await sellerClient.storage
    .from(USED_PHOTO_BUCKET)
    .upload(withdrawnPhoto, await photo().webp().toBuffer(), { contentType: 'image/webp' })
  expect(reupload.error).not.toBeNull()
  expect(await usedPhotoExists(withdrawnPhoto)).toBe(false)

  // Tin đã duyệt đổi ảnh X → Y (về chờ duyệt): X hết gắn tin nên xóa được, nhưng tên X đã từng gắn tin nên không tải
  // lại được (link ký cũ của X còn hạn sẽ hiện ảnh mới chưa duyệt)
  const swappedPhoto = await uploadPhoto(sellerClient, seller)
  const swapId = await createListing(sellerClient, [swappedPhoto])
  await approve(swapId)
  const replacementPhoto = await uploadPhoto(sellerClient, seller)
  const swap = await sellerClient.rpc('update_used_listing', {
    p_id: swapId,
    p_condition: 'good',
    p_price: 80_000,
    p_description: 'Đổi ảnh khác',
    p_photos: [replacementPhoto],
  })
  expect(swap.error).toBeNull()
  expect((await usedListingRow(swapId))?.status).toBe('pending')
  await remove(sellerClient, swappedPhoto)
  expect(await usedPhotoExists(swappedPhoto)).toBe(false)
  const reuploadSwapped = await sellerClient.storage
    .from(USED_PHOTO_BUCKET)
    .upload(swappedPhoto, await photo().webp().toBuffer(), { contentType: 'image/webp' })
  expect(reuploadSwapped.error).not.toBeNull()
  expect(await usedPhotoExists(swappedPhoto)).toBe(false)

  // Ảnh của tin chờ duyệt mất ngoài policy (xóa tay trong Storage) → không duyệt được (mã riêng cho admin), tin vẫn chờ
  // duyệt
  const lostPhoto = await uploadPhoto(sellerClient, seller)
  const lostId = await createListing(sellerClient, [lostPhoto])
  await removeUsedPhotoAsService(lostPhoto)
  expect((await review(adminClient, lostId, 'pending', true)).error?.message).toBe('LISTING_PHOTOS_MISSING')
  expect((await usedListingRow(lostId))?.status).toBe('pending')
})

test('tối đa 10 tin chờ duyệt mỗi người, kể cả khi sửa tin đã duyệt', async () => {
  const path = await uploadPhoto(seller2Client, seller2)
  const approvedId = await createListing(seller2Client, [path], 9_000)
  await approve(approvedId)
  for (let i = 0; i < 10; i++) await createListing(seller2Client, [path], 10_000 + i * 1_000)
  const eleventh = await seller2Client.rpc('create_used_listing', {
    p_book_id: book.id,
    p_condition: 'worn',
    p_price: 9_000,
    p_description: '',
    p_photos: [path],
  })
  expect(eleventh.error?.message).toBe('LISTING_PENDING_LIMIT')

  // Sửa tin đã duyệt = thêm một tin chờ duyệt → cũng bị chặn, tin vẫn đang bán
  const edit = await seller2Client.rpc('update_used_listing', {
    p_id: approvedId,
    p_condition: 'worn',
    p_price: 8_000,
    p_description: '',
    p_photos: [path],
  })
  expect(edit.error?.message).toBe('LISTING_PENDING_LIMIT')
  expect(await usedListingRow(approvedId)).toMatchObject({ status: 'approved', price: 9_000 })
})

test('tối đa 30 ảnh mỗi người: ảnh thứ 31 bị chặn', async () => {
  test.setTimeout(60_000)
  // User riêng: số ảnh của người bán chung phụ thuộc các test khác
  const uploader = await createE2eUser('used-photos')
  try {
    const client = await signedInClient(uploader)
    // Tuần tự: đếm ảnh không khóa, tải song song có thể vượt trần
    for (let i = 0; i < 30; i++) await uploadPhoto(client, uploader)
    const extra = await client.storage
      .from(USED_PHOTO_BUCKET)
      .upload(`${uploader.id}/${randomUUID()}.webp`, await photo().webp().toBuffer(), { contentType: 'image/webp' })
    expect(extra.error).not.toBeNull()
  } finally {
    await deleteE2eUsers([uploader.id])
  }
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
  expect((await anon.rpc('quote_used_order', { p_listing_id: id })).error).not.toBeNull()

  expect((await placeUsedOrder(sellerClient, id, sellerAddress, randomUUID(), total)).error?.message).toBe('LISTING_OWN')
  const changed = await placeUsedOrder(buyerClient, id, buyerAddress, randomUUID(), total - 1)
  expect(changed.error?.message).toBe('LISTING_CHANGED')
  expect(JSON.parse(changed.error?.details ?? '{}')).toEqual({ total })
  const noKey = await buyerClient.rpc('place_used_order', {
    p_listing_id: id,
    p_address_id: buyerAddress,
    p_expected_updated_at: await usedListingUpdatedAt(id),
    p_expected_total: total,
  })
  expect(noKey.error?.message).toBe('INVALID_INPUT')

  const key = randomUUID()
  const viewed = await usedListingUpdatedAt(id)
  const order = await placedOrder(placeUsedOrder(buyerClient, id, buyerAddress, key, total, 'cod', viewed))
  expect(order).toMatchObject({ status: 'pending', subtotal: price, shipping_fee: SHIPPING_FEE, total })
  // Gửi lại cùng key với đúng bản đã xem (tin giờ đã bán, updated_at đã đổi): idempotency chạy trước mọi kiểm tin
  expect(await usedListingUpdatedAt(id)).not.toBe(viewed)
  const again = await placedOrder(placeUsedOrder(buyerClient, id, buyerAddress, key, total, 'cod', viewed))
  expect(again.id).toBe(order.id)
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
  const second = await placedOrder(placeUsedOrder(buyerClient, id, buyerAddress, randomUUID(), total))
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
  // Ảnh của tin đã bán không xóa được (trang chi tiết "Đã bán" vẫn hiện ảnh); Storage không báo lỗi khi policy chặn
  await sellerClient.storage.from(USED_PHOTO_BUCKET).remove([path])
  expect(await usedPhotoExists(path)).toBe(true)

  // Người bán xem đơn đã bán: không có cột nào của người mua / mã đơn; đơn đã hủy không tính
  const sales = await sellerClient.rpc('my_used_sales')
  if (sales.error) throw new Error(`my_used_sales: ${sales.error.message}`)
  const rows = sales.data
  expect(rows).toHaveLength(1)
  expect(Object.keys(rows[0] ?? {}).sort()).toEqual(
    ['amount', 'fee', 'listing_id', 'order_status', 'payment_status', 'payout_status', 'price', 'sold_at', 'title'].sort(),
  )
  expect(rows[0]).toMatchObject({ listing_id: id, price, fee: 10_000, amount: price - 10_000, order_status: 'delivered', payout_status: 'pending' })
  expect((await buyerClient.rpc('my_used_sales')).data).toEqual([])

  // Sổ tiền: người bán thấy khoản của mình, người mua không thấy; chỉ admin đánh dấu đã trả, một lần
  const payoutId = payouts[0]?.id ?? 0
  expect(await visibleRows(sellerClient, payoutId)).toEqual([payoutId])
  expect(await visibleRows(buyerClient, payoutId)).toEqual([])
  // Người bán không đọc được order_id (không lần ra đơn / người mua); cột khác vẫn đọc được
  const orderId = await sellerClient.from('seller_payouts').select('order_id').eq('id', payoutId)
  expect(orderId.error?.message).toMatch(/permission denied/)
  const own = await sellerClient.from('seller_payouts').select('listing_id, amount, status').eq('id', payoutId)
  expect(own.error).toBeNull()
  expect(own.data).toEqual([{ listing_id: id, amount: price - 10_000, status: 'pending' }])
  expect((await sellerClient.rpc('mark_payout_paid', { p_id: payoutId })).error?.message).toBe('FORBIDDEN')
  expect((await adminClient.rpc('mark_payout_paid', { p_id: payoutId })).error).toBeNull()
  expect((await sellerPayoutsOf(id))[0]).toMatchObject({ status: 'paid', paid_at: expect.any(String) })
  expect((await adminClient.rpc('mark_payout_paid', { p_id: payoutId })).error?.message).toBe('PAYOUT_STATUS_CHANGED')
})

test('(r2) mua với updated_at cũ (tin đã sửa rồi duyệt lại, cùng giá) → LISTING_CHANGED, không tạo đơn, tin vẫn đang bán', async () => {
  test.setTimeout(60_000)
  const path = await uploadPhoto(sellerClient, seller)
  const price = 60_000
  const total = price + SHIPPING_FEE
  const id = await createListing(sellerClient, [path], price)
  await approve(id)
  const stale = await usedListingUpdatedAt(id)
  // Người bán đổi tình trạng + mô tả, giữ giá → về chờ duyệt → admin duyệt lại: tổng tiền như cũ
  const edit = await sellerClient.rpc('update_used_listing', {
    p_id: id,
    p_condition: 'worn',
    p_price: price,
    p_description: 'Gáy đã rách',
    p_photos: [path],
  })
  expect(edit.error).toBeNull()
  await approve(id)
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved', price })

  const address = await seedAddress(buyer.id, { isDefault: false })
  const key = randomUUID()
  const changed = await placeUsedOrder(buyerClient, id, address, key, total, 'cod', stale)
  expect(changed.error?.message).toBe('LISTING_CHANGED')
  expect(JSON.parse(changed.error?.details ?? '{}')).toEqual({ total })
  const orders = await buyerClient.from('orders').select('id').eq('idempotency_key', key)
  expect(orders.error).toBeNull()
  expect(orders.data).toEqual([])
  expect((await usedListingRow(id))?.status).toBe('approved')

  // Xem lại tin (updated_at mới) → mua được, cùng key
  const order = await placedOrder(placeUsedOrder(buyerClient, id, address, key, total))
  expect(order).toMatchObject({ status: 'pending', total })
  expect((await usedListingRow(id))?.status).toBe('sold')
})

test('(r3) admin_seller_payouts: chỉ admin; một tin có đơn hủy + đơn đã giao → đúng một khoản kèm mã đơn đã giao', async () => {
  test.setTimeout(60_000)
  expect((await buyerClient.rpc('admin_seller_payouts')).error?.message).toBe('FORBIDDEN')
  expect((await sellerClient.rpc('admin_seller_payouts')).error?.message).toBe('FORBIDDEN')
  // anon không có quyền execute (revoke public, anon)
  const anonCall = await anon.rpc('admin_seller_payouts')
  expect(anonCall.error).not.toBeNull()
  expect(anonCall.data).toBeNull()

  const path = await uploadPhoto(sellerClient, seller)
  const price = 70_000
  const fee = 7_000
  const total = price + SHIPPING_FEE
  const id = await createListing(sellerClient, [path], price)
  await approve(id)
  const address = await seedAddress(buyer.id, { isDefault: false })
  const first = await placedOrder(placeUsedOrder(buyerClient, id, address, randomUUID(), total))
  expect((await buyerClient.rpc('cancel_order', { p_order_id: first.id })).error).toBeNull()
  const second = await placedOrder(placeUsedOrder(buyerClient, id, address, randomUUID(), total))
  await deliverOrder(second.id)

  const result = await adminClient.rpc('admin_seller_payouts')
  if (result.error) throw new Error(`admin_seller_payouts: ${result.error.message}`)
  // Khoản của project khác (chạy song song) cũng nằm trong kết quả → chỉ xét khoản của tin này
  const rows = result.data.filter((row) => row.listing_id === id)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    order_id: second.id,
    order_code: second.order_code,
    order_status: 'delivered',
    payment_status: 'paid',
    seller_id: seller.id,
    seller_name: seller.fullName,
    price,
    fee,
    amount: price - fee,
    status: 'pending',
    paid_at: null,
  })
  // Không có cột nào của người mua (tên, điện thoại, địa chỉ, email, user_id)
  expect(Object.keys(rows[0] ?? {}).sort()).toEqual(
    [
      'id',
      'order_id',
      'order_code',
      'order_status',
      'payment_status',
      'listing_id',
      'seller_id',
      'seller_name',
      'title',
      'price',
      'fee',
      'amount',
      'status',
      'paid_at',
      'created_at',
    ].sort(),
  )
})

test('chuyển khoản: thanh toán trước rồi giao → đúng một khoản; đơn hết "đã thanh toán" thì không đánh dấu đã trả được', async () => {
  test.setTimeout(60_000)
  const path = await uploadPhoto(sellerClient, seller)
  const price = 50_000
  const id = await createListing(sellerClient, [path], price)
  await approve(id)
  const address = await seedAddress(buyer.id, { isDefault: false })
  const order = await placedOrder(
    placeUsedOrder(buyerClient, id, address, randomUUID(), price + SHIPPING_FEE, 'bank_transfer'),
  )

  // Cửa hàng đối soát chuyển khoản trước khi giao: chưa giao thì chưa có khoản
  await setPaymentStatus(order.id, 'paid')
  expect(await sellerPayoutsOf(id)).toEqual([])
  await deliverOrder(order.id)
  const payouts = await sellerPayoutsOf(id)
  expect(payouts).toHaveLength(1)
  expect(payouts[0]).toMatchObject({ order_id: order.id, price, fee: 5_000, amount: price - 5_000, status: 'pending' })

  // Đơn ghi hoàn tiền (sửa tay) → không còn "đã giao + đã thanh toán": không đánh dấu đã trả được
  await setPaymentStatus(order.id, 'refunded')
  const payoutId = payouts[0]?.id ?? 0
  expect((await adminClient.rpc('mark_payout_paid', { p_id: payoutId })).error?.message).toBe('PAYOUT_STATUS_CHANGED')
  expect((await sellerPayoutsOf(id))[0]).toMatchObject({ status: 'pending', paid_at: null })
})

async function visibleRows(client: Client, payoutId: number) {
  const { data, error } = await client.from('seller_payouts').select('id').eq('id', payoutId)
  if (error) throw new Error(`visibleRows: ${error.message}`)
  return data.map((row) => row.id)
}
