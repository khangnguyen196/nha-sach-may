import { getCategories } from '@/features/books/queries'
import { getCurrentUser } from '@/lib/auth'
import { blockCss, expandBlocks } from '../blocks'
import { getMyBlocks } from '../queries'
import { RevealBlocked } from './reveal-blocked'

/**
 * Che sách bị chặn ở mọi danh sách (câu 3, phương án A): trang catalog vẫn prerender / cache chung cho mọi người, phần
 * theo người dùng chỉ là một <style> sinh sau khi đọc phiên. Đặt trong <Suspense fallback={null}> của
 * `[locale]/layout.tsx` (bao header + mọi trang của cửa hàng; layout dùng chung không render lại khi chuyển trang phía
 * client → style giữ nguyên). Khách / không có mục chặn → không render gì (không <style>, không nút Xem). <style> nằm
 * trong RevealBlocked (client leaf), HTML vẫn có sẵn từ server.
 * Lỗi đọc mục chặn → không che (log mã lỗi), không đẩy lỗi lên error boundary của cả layout.
 */
export async function BlockStyles() {
  const user = await getCurrentUser()
  if (!user) return null
  let css: string
  try {
    const [rules, categories] = await Promise.all([getMyBlocks(), getCategories()])
    css = blockCss(expandBlocks(rules, categories))
  } catch (error) {
    console.error('[prefs] BlockStyles:', error instanceof Error ? error.message : 'unknown')
    return null
  }
  if (!css) return null
  return <RevealBlocked css={css} />
}
