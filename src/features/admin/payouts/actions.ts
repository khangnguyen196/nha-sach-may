'use server'

import { refresh } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { withMessage } from '@/lib/error-message'
import { toFailure, type Failure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '../auth'
import { payoutIdSchema } from './schemas'

// Đánh dấu đã trả người bán: MÔ PHỎNG, chỉ ghi trạng thái trong sổ (không chuyển tiền, không có tài khoản ngân hàng).
// RPC mark_payout_paid kiểm is_admin, khóa đơn rồi chỉ nhận khoản đang chờ trả của đơn còn đã giao + đã thanh toán.
// id do page bind (đi qua client nên parse lại). Câu đầu là assertAdmin (Server Action gọi thẳng được bằng action ID).

const UNKNOWN: Failure = { ok: false, code: 'UNKNOWN' }

export async function markPayoutPaid(id: number): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const payoutId = payoutIdSchema.safeParse(id)
  if (!payoutId.success) return UNKNOWN

  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_payout_paid', { p_id: payoutId.data })
  if (error) {
    const failure = toFailure(error)
    if (failure.code !== 'PAYOUT_STATUS_CHANGED') return withMessage('vi', failure)
    // Đã trả ở tab khác / đơn đổi trạng thái thanh toán: trang render lại trạng thái thật (nút biến mất), câu riêng của
    // admin không bảo "tải lại trang"
    refresh()
    const t = await getTranslations({ locale: 'vi', namespace: 'admin.payouts' })
    return { ...failure, message: t('payoutChanged') }
  }
  refresh()
  return { ok: true, data: null }
}
