import 'server-only'
import { createAdminQueryClient } from '../supabase'
import { LOW_STOCK } from '../books/params'

type CountResult = { count: number | null; error: { message: string } | null }

function countOf({ count, error }: CountResult, label: string) {
  if (error) throw new Error(`getDashboardCounts (${label}): ${error.message}`)
  return count ?? 0
}

/** Số liệu trang tổng quan (client theo phiên, admin thấy cả đơn của mọi người và sách ẩn). Chỉ đếm, không tải dòng. */
export async function getDashboardCounts() {
  const supabase = await createAdminQueryClient()
  const head = { count: 'exact', head: true } as const
  const [pendingOrders, lowStock, outOfStock, hiddenBooks] = await Promise.all([
    supabase.from('orders').select('id', head).eq('status', 'pending'),
    supabase.from('books').select('id', head).eq('is_active', true).gt('stock', 0).lte('stock', LOW_STOCK),
    supabase.from('books').select('id', head).eq('is_active', true).eq('stock', 0),
    supabase.from('books').select('id', head).eq('is_active', false),
  ])
  return {
    pendingOrders: countOf(pendingOrders, 'pendingOrders'),
    lowStock: countOf(lowStock, 'lowStock'),
    outOfStock: countOf(outOfStock, 'outOfStock'),
    hiddenBooks: countOf(hiddenBooks, 'hiddenBooks'),
  }
}
