import { headers } from 'next/headers'
import { Suspense } from 'react'
import { Footer } from '@/components/layout/footer'
import { NotFoundView } from '@/components/layout/not-found-view'
import { NOT_FOUND_HEADER, parseNotFoundKind } from '@/lib/not-found-kind'

export default function NotFound() {
  // Boundary này nằm ở [locale] (ngoài layout của route group) nên tự dựng <main> + footer
  return (
    <>
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-reading px-4 py-24">
          {/* Loại trang thiếu (sách, danh mục, đơn…) do proxy gắn vào request lúc rewrite; HTTP 404 đã quyết trước khi
              stream nên phần đọc header nằm trong Suspense, fallback là câu chung */}
          <Suspense fallback={<NotFoundView kind="page" />}>
            <NotFoundForRequest />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  )
}

async function NotFoundForRequest() {
  const kind = parseNotFoundKind((await headers()).get(NOT_FOUND_HEADER))
  return <NotFoundView kind={kind} />
}
