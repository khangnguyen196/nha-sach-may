import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { Link, type Href } from '@/i18n/navigation'
import type { BookCard as BookCardData } from '../queries'
import { BookCard } from './book-card'
import { BookCardSkeleton } from './book-grid-skeleton'

const ITEM_CLASS = 'w-36 shrink-0 snap-start sm:w-40'
// relative: phần tử absolute bên trong (sr-only của BookCard) lấy danh sách làm containing block nên bị vùng cuộn
// cắt; thiếu nó thì chúng nằm ngoài lề phải, kéo document rộng ra (~1456px ở trang sách) và mobile tự thu nhỏ trang
const LIST_CLASS = 'relative -mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6'

type Props = {
  id: string
  title: string
  href?: Href
  books: BookCardData[]
}

/** Kệ sách: hàng ngang cuộn được (scroll-snap). Đơn vị bố cục chính của trang chủ ở Phase 8. */
export async function Shelf({ id, title, href, books }: Props) {
  if (books.length === 0) return null
  const t = await getTranslations('catalog')

  return (
    <section aria-labelledby={id}>
      <ShelfHeading id={id} title={title}>
        {href && (
          <Link
            href={href}
            className="rounded-sm text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t('seeAll')}
          </Link>
        )}
      </ShelfHeading>
      <ul className={LIST_CLASS}>
        {books.map((book) => (
          <li key={book.id} className={ITEM_CLASS}>
            <BookCard book={book} sizes="160px" />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ShelfSkeleton({ id, title }: { id: string; title: string }) {
  return (
    <section aria-labelledby={id} aria-busy>
      <ShelfHeading id={id} title={title} />
      <ul aria-hidden className={LIST_CLASS}>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className={ITEM_CLASS}>
            <BookCardSkeleton />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ShelfHeading({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </div>
  )
}
