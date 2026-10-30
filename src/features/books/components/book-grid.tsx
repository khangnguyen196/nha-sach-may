import type { BookCard as BookCardData } from '../queries'
import { cn } from '@/lib/utils'
import { BookCard } from './book-card'

export const GRID_CLASS = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'

// Card tải ngay (không lazy) = cả hàng đầu ở lưới rộng nhất (xl 6 cột); trước đây 4 nên bìa thứ 5–6 của hàng đầu desktop
// hiện trễ. Cỡ nhỏ hơn: hàng đầu + vài card hàng sau. Ưu tiên cao vẫn chỉ PRELOAD_COUNT ảnh đầu (bên dưới)
const EAGER_COUNT = 6
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
