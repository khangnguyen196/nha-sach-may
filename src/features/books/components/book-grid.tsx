import type { BookCard as BookCardData } from '../queries'
import { cn } from '@/lib/utils'
import { BookCard } from './book-card'

export const GRID_CLASS = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'

// Số card thường lọt màn hình đầu ở mọi cỡ (mobile 2 cột × 2 hàng, desktop 1 hàng)
const EAGER_COUNT = 4
// Ảnh LCP của trang lưới là bìa đầu tiên (đo trên mobile: LCP danh mục 5,2 s vì 24 ảnh tranh băng thông như nhau).
// 2 ảnh đầu (hàng đầu mobile) ưu tiên cao; ưu tiên nhiều ảnh hơn lại tranh băng thông của chính ảnh LCP.
const PRELOAD_COUNT = 2

export function BookGrid({ books }: { books: BookCardData[] }) {
  return (
    // Đang chuyển trang / lọc (CatalogPending): lưới mờ đi
    <ul
      className={cn(
        GRID_CLASS,
        'transition-opacity duration-200 ease-out group-data-pending/catalog:opacity-50 motion-reduce:transition-none',
      )}
    >
      {books.map((book, index) => (
        <li key={book.id}>
          <BookCard book={book} eager={index < EAGER_COUNT} preload={index < PRELOAD_COUNT} />
        </li>
      ))}
    </ul>
  )
}
