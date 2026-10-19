import { createFormatter, createTranslator } from 'use-intl/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from '../../../messages/en.json'
import vi_ from '../../../messages/vi.json'
import { formats } from '@/i18n/formats'

// Lỗi DB mà e2e không tạo ra được (detail thiếu `shortfall`, đơn không có / của tài khoản khác) → Vitest với RPC giả +
// bản dịch thật (messages + formats của app).
const rpc = vi.fn()
const refresh = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ refresh }))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('next-intl/server', () => {
  const messages = (locale: 'vi' | 'en') => (locale === 'en' ? en : vi_)
  return {
    getTranslations: async ({ locale, namespace }: { locale: 'vi' | 'en'; namespace: 'errors' | 'checkout' }) =>
      createTranslator({ locale, messages: messages(locale), namespace, formats, timeZone: 'Asia/Ho_Chi_Minh' }),
    getFormatter: async ({ locale }: { locale: 'vi' | 'en' }) => createFormatter({ locale, formats, timeZone: 'Asia/Ho_Chi_Minh' }),
  }
})
vi.mock('@/i18n/navigation', () => ({ getPathname: () => '/', redirect: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => ({ id: 'user-1', email: 'a@example.com', fullName: null }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }))
vi.mock('@/features/orders/cache', () => ({ expireOrderBooks: vi.fn() }))
vi.mock('@/features/orders/emails', () => ({ notifyOrder: vi.fn(), ownRecipient: vi.fn() }))

const { getCheckoutQuote } = await import('./queries')
const { cancelOrder } = await import('@/features/orders/actions')

const QUOTE = { subtotal: 100_000, shipping_fee: 30_000, discount: 0, total: 130_000, free_ship_from: 300_000 }

/** quote_order: có mã → lỗi `error`; không mã → báo giá thường */
function quoteOrderFails(error: { message: string; details?: string; code?: string }) {
  rpc.mockImplementation((_name: string, args: { p_voucher_code?: string }) => ({
    single: async () => (args.p_voucher_code ? { data: null, error: { code: 'P0001', ...error } } : { data: QUOTE, error: null }),
  }))
}

beforeEach(() => {
  rpc.mockReset()
  refresh.mockReset()
})

describe('báo giá thanh toán: lỗi voucher thiếu detail', () => {
  it('VOUCHER_MIN_ORDER không có shortfall trong detail → tự tính số tiền còn thiếu từ tạm tính', async () => {
    quoteOrderFails({ message: 'VOUCHER_MIN_ORDER', details: '{"min_order_value": 150000}' })
    const { voucher } = await getCheckoutQuote('vi', { code: 'GIAM20K' })
    expect(voucher?.failure?.message?.replace(/\s/g, ' ')).toBe('Mua thêm 50.000 ₫ để dùng mã này (đơn từ 150.000 ₫).')
  })
})

describe('hủy đơn: đơn không có / của tài khoản khác', () => {
  it('ORDER_NOT_CANCELLABLE → câu "tải lại trang…", trang làm mới để hiện trạng thái thật', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'ORDER_NOT_CANCELLABLE' } })
    const result = await cancelOrder('vi', 7, 'NS26101800001', null, new FormData())
    expect(result).toMatchObject({
      ok: false,
      code: 'ORDER_NOT_CANCELLABLE',
      message: 'Không hủy được đơn này. Bạn tải lại trang để xem trạng thái mới nhất.',
    })
    expect(rpc).toHaveBeenCalledWith('cancel_order', expect.objectContaining({ p_order_id: 7 }))
    expect(refresh).toHaveBeenCalled()
  })
})
