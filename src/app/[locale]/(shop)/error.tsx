'use client'

import { LocaleError } from '@/components/layout/locale-error'

// Lỗi ở trang bán hàng (VD không gọi được Supabase): nằm trong <main> + footer của layout (shop), khung trang giữ nguyên
export default function ShopErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <LocaleError digest={error.digest} retry={retry} />
}
