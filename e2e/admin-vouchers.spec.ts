import { expect, type Page } from '@playwright/test'
import { createE2eVoucher, deleteE2eVouchers, e2eVoucherCode, signedInClient, voucherRow } from '../scripts/e2e-user'
import { adminTest as test, main } from './admin'
import { collectErrors, waitForHydration } from './helpers'

// Voucher trong admin. Mã test E2E-ADMIN-…, tạo qua UI (khi chính việc tạo là thứ được test) hoặc service role; mỗi
// test xóa đúng mã của mình ở finally (teardown xóa mọi E2E-ADMIN-… còn sót).

async function openForm(page: Page, path: string) {
  await page.goto(path)
  await waitForHydration(page, 'main form button[type="submit"]')
}

const field = (page: Page, label: string) => main(page).getByLabel(label, { exact: true })

async function save(page: Page) {
  await main(page).getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(main(page).getByRole('status').filter({ hasText: 'Đã lưu.' })).toBeVisible({ timeout: 15_000 })
}

test('tạo: mã viết thường tự thành HOA; % > 100 → lỗi tại ô; mã trùng → lỗi tại ô', async ({ page }) => {
  const errors = collectErrors(page)
  const code = e2eVoucherCode()
  try {
    await openForm(page, '/admin/voucher/moi')
    await field(page, 'Mã').fill(code.toLowerCase())
    await field(page, 'Mức giảm').fill('150')
    await field(page, 'Giảm tối đa (₫)').fill('30.000')
    await main(page).getByRole('button', { name: 'Tạo' }).click()
    await expect(main(page).getByText('Giảm theo % chỉ từ 1 đến 100.')).toBeVisible()
    expect(await voucherRow(code)).toBeNull()

    await field(page, 'Mức giảm').fill('15')
    await main(page).getByRole('button', { name: 'Tạo' }).click()
    await expect(page).toHaveURL(/\/admin\/voucher$/, { timeout: 15_000 })
    expect(await voucherRow(code)).toMatchObject({
      code,
      discount_type: 'percent',
      discount_value: 15,
      max_discount: 30_000,
      min_order_value: 0,
      is_active: true,
    })

    await page.goto(`/admin/voucher?q=${code.toLowerCase()}`)
    const row = main(page).getByRole('row').filter({ hasText: code })
    await expect(row).toContainText(/15%, tối đa 30\.000\s₫/)
    await expect(row.getByTestId('voucher-state')).toHaveText('Đang chạy')

    await openForm(page, '/admin/voucher/moi')
    await field(page, 'Mã').fill(code)
    await field(page, 'Mức giảm').fill('10')
    await main(page).getByRole('button', { name: 'Tạo' }).click()
    await expect(main(page).getByText('Mã này đã có voucher khác dùng.')).toBeVisible()
    expect(errors).toEqual([])
  } finally {
    await deleteE2eVouchers([code])
  }
})

test('sửa: tắt rồi bật lại; thời gian nhập theo giờ VN; kết thúc trước bắt đầu → lỗi', async ({ page }) => {
  const voucher = await createE2eVoucher()
  try {
    await openForm(page, `/admin/voucher/${voucher.id}`)
    await field(page, 'Đang bật').uncheck()
    await field(page, 'Bắt đầu').fill('2026-10-20T08:30')
    await field(page, 'Kết thúc').fill('2026-10-20T08:00')
    await main(page).getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(main(page).getByText('Thời điểm kết thúc phải sau thời điểm bắt đầu.')).toBeVisible()

    await field(page, 'Kết thúc').fill('2026-11-01T00:00')
    await save(page)
    expect(await voucherRow(voucher.code)).toMatchObject({
      is_active: false,
      starts_at: '2026-10-20T01:30:00+00:00',
      ends_at: '2026-10-31T17:00:00+00:00',
    })
    await page.goto(`/admin/voucher?q=${voucher.code}`)
    await expect(main(page).getByTestId('voucher-state')).toHaveText('Đã tắt')

    // Mở lại trang sửa: ô thời gian hiện đúng giờ VN đã nhập
    await openForm(page, `/admin/voucher/${voucher.id}`)
    await expect(field(page, 'Bắt đầu')).toHaveValue('2026-10-20T08:30')
    await field(page, 'Đang bật').check()
    await field(page, 'Bắt đầu').fill('')
    await field(page, 'Kết thúc').fill('')
    await save(page)
    expect(await voucherRow(voucher.code)).toMatchObject({ is_active: true, starts_at: null, ends_at: null })
  } finally {
    await deleteE2eVouchers([voucher.code])
  }
})

test('xóa: voucher đã dùng → chỉ tắt được; chưa dùng → xóa', async ({ page }) => {
  const used = await createE2eVoucher({ usedCount: 1 })
  const unused = await createE2eVoucher()
  try {
    await openForm(page, `/admin/voucher/${used.id}`)
    await expect(main(page).getByText('Voucher đã có đơn dùng: tắt đi thay vì xóa.')).toBeVisible()
    await main(page).getByRole('button', { name: 'Xóa voucher' }).click()
    await expect(main(page).getByRole('alert')).toHaveText(
      'Voucher đã có đơn hàng dùng nên chỉ tắt được, không xóa được.',
      { timeout: 15_000 },
    )
    expect(await voucherRow(used.code)).not.toBeNull()

    await openForm(page, `/admin/voucher/${unused.id}`)
    await main(page).getByRole('button', { name: 'Xóa voucher' }).click()
    await expect(page).toHaveURL(/\/admin\/voucher$/, { timeout: 15_000 })
    expect(await voucherRow(unused.code)).toBeNull()
  } finally {
    await deleteE2eVouchers([used.code, unused.code])
  }
})

// Chờ migration 20261016020000_payments_email.sql (quyền cột vouchers): trước khi chạy migration test này fail.
test('admin gọi thẳng PostgREST: không sửa được used_count (do place_order / trigger quản lý)', async ({ admin }) => {
  const voucher = await createE2eVoucher()
  try {
    const client = await signedInClient(admin)
    const { error } = await client.from('vouchers').update({ used_count: 99 }).eq('id', voucher.id)
    expect(error?.code).toBe('42501')
    // Cột của form admin vẫn sửa được
    const allowed = await client.from('vouchers').update({ is_active: false }).eq('id', voucher.id)
    expect(allowed.error).toBeNull()
  } finally {
    await deleteE2eVouchers([voucher.code])
  }
})
