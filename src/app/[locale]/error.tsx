'use client'

import { LocaleError } from '@/components/layout/locale-error'

// Lỗi ở layout của route group ((shop) / (auth): VD footer không đọc được danh mục) hoặc trang không có boundary gần
// hơn. Boundary này nằm ngoài layout của group nên tự dựng <main> (như not-found.tsx); không có footer vì footer có
// thể chính là chỗ lỗi.
export default function LocaleErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="main" className="flex-1">
      <LocaleError digest={error.digest} retry={retry} />
    </main>
  )
}
