import { MessageCircleIcon } from 'lucide-react'
import { locale as rootLocale } from 'next/root-params'
import { Footer } from '@/components/layout/footer'
import { getLazyErrorLabels } from '@/components/lazy-error-labels'
import { ChatBubble } from '@/features/chat/components/chat-bubble'
import { chatEnabled } from '@/features/chat/env'
import { getChatBrowseCategories, getChatLabels } from '@/features/chat/labels'

export default function ShopLayout({ children }: LayoutProps<'/[locale]'>) {
  return (
    <>
      {/* Cao tối thiểu = màn hình trừ header (h-16): footer luôn nằm dưới màn hình đầu, nội dung stream tới (kết quả
          tìm kiếm, giỏ khách đọc localStorage) có đẩy footer cũng không tính vào CLS (đo trên mobile: 0,15 → mục tiêu < 0,1) */}
      <main id="main" className="min-h-[calc(100dvh_-_var(--spacing)*16)] flex-1">
        {children}
      </main>
      <Footer />
      <Chat />
    </>
  )
}

/**
 * Chatbot Mây: chỉ trang tiếng Việt (không có markup ở /en), không có ở (auth) và /admin (layout khác), ẩn ở trang
 * thanh toán (client, visibility.ts). Thiếu GEMINI_API_KEY / CHAT_QUOTA_TOKEN → không có bong bóng.
 */
async function Chat() {
  if ((await rootLocale()) !== 'vi' || !chatEnabled()) return null
  const [labels, categories, lazyError] = await Promise.all([
    getChatLabels(),
    getChatBrowseCategories(),
    getLazyErrorLabels(),
  ])
  return (
    <ChatBubble
      labels={labels}
      categories={categories}
      lazyError={lazyError}
      icon={<MessageCircleIcon aria-hidden />}
    />
  )
}
