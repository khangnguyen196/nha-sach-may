import { ArrowRightIcon } from 'lucide-react'
import type { BookCard } from '@/features/books/queries'
import { Link, type Href } from '@/i18n/navigation'
import { BookTile, type TileLoading } from './book-tile'

type Props = {
  id: string
  title: string
  books: BookCard[]
  variant: 'sale' | 'title'
  more: { href: Href; label: string }
  /** Ảnh của 2–3 thẻ đầu tải ngay; `preload` chỉ cho bìa đầu tiên của thẻ đầu (ứng viên LCP) */
  loading: TileLoading
}

/** Thẻ khuyến mãi có lưới 2×2 bìa sách (Đang giảm giá, Bán chạy, Sách ngoại văn), nền surface như thẻ thường */
export function BookTilesCard({ id, title, books, variant, more, loading }: Props) {
  const tileLoading = (index: number): TileLoading => (loading === 'preload' ? (index === 0 ? 'preload' : 'eager') : loading)
  return (
    <article aria-labelledby={id} className="flex w-full flex-col rounded-lg border bg-surface p-5">
      <h3 id={id} className="mb-3.5 text-lg font-semibold">
        {title}
      </h3>
      <ul className="grid grid-cols-2 gap-3">
        {books.map((book, index) => (
          <BookTile key={book.id} book={book} variant={variant} loading={tileLoading(index)} />
        ))}
      </ul>
      <Link
        href={more.href}
        className="group mt-auto inline-flex items-center gap-1.5 self-start rounded-sm pt-3.5 text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus-ring"
      >
        {more.label}
        <ArrowRightIcon aria-hidden className="size-4 transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-0.5" />
      </Link>
    </article>
  )
}
