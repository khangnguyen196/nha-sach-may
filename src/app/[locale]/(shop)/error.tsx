'use client'

import { LocaleError } from '@/components/layout/locale-error'

// Lỗi ở trang bán hàng (Supabase chập chờn…): nằm trong <main> + footer của layout (shop), khung trang giữ nguyên
export default function ShopErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <LocaleError retry={retry} />
}
