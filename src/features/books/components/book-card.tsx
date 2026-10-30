import { BookIcon } from 'lucide-react'
import Image from 'next/image'
import { getFormatter, getTranslations } from 'next-intl/server'
import { BlockedVeil } from '@/features/prefs/components/blocked-veil'
import { bookSlotAttributes } from '@/features/prefs/blocks'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import type { BookCard as BookCardData } from '../queries'
import { discountPercent } from '../utils'

/** sizes khớp lưới 2 / 3 / 4 / 5 / 6 cột trong khung max-w-6xl */
export const GRID_IMAGE_SIZES =
  '(min-width: 1280px) 176px, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw'

type Props = {
  book: BookCardData
  sizes?: string
  /** Hàng đầu của lưới thường nằm trong màn hình đầu → tải ngay, không chờ lazy */
  eager?: boolean
  /**
   * Ảnh có thể là LCP (1–2 card đầu lưới): ưu tiên tải cao + preload. Lưới ở trang danh mục / `/sach` / tìm kiếm stream
   * theo searchParams nên preload tới cùng lúc với thẻ img (React không đưa lên <head>); chỉ fetchPriority có tác dụng
   * ở đó, preload có tác dụng khi lưới nằm trong phần prerender.
   */
  preload?: boolean
}

export async function BookCard({ book, sizes = GRID_IMAGE_SIZES, eager = false, preload = false }: Props) {
  const [t, format] = await Promise.all([getTranslations('book'), getFormatter()])
  const authors = book.book_authors.flatMap((ba) => (ba.role === 'author' && ba.authors ? [ba.authors.name] : []))
  const discount = discountPercent(book.price, book.original_price)
  const soldOut = book.stock <= 0

  return (
    // Khung thẻ mang khóa chặn (data-*): <style> theo phiên của BlockStyles che link + hiện ô mờ, không đổi HTML prerender.
    // h-full: khung = cả ô của lưới / kệ (ô cùng hàng cao bằng nhau) → ô mờ cùng kích thước thẻ cạnh bên
    <div {...bookSlotAttributes(book)} className="relative h-full">
      <Link
        href={{ pathname: '/books/[slug]', params: { slug: book.slug } }}
        data-book-link
        className="group block rounded-lg transition-transform duration-200 ease-out outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-focus-ring"
      >
        {/* Viền mảnh quanh bìa (bìa nền trắng lẫn vào nền sáng): lớp ::after nằm trên ảnh (ring-inset của chính khung bị ảnh
            đè), không nhận chuột; nhãn hết hàng nằm cách mép nên không bị viền chạm, ô mờ BlockedVeil ngoài link vẫn đè lên */}
        <div className="relative aspect-[2/3] overflow-hidden rounded-cover bg-surface-raised transition-shadow duration-200 ease-out group-hover:shadow-glow after:pointer-events-none after:absolute after:inset-0 after:rounded-cover after:ring-1 after:ring-border after:ring-inset">
          {book.cover_url ? (
            // alt rỗng: tên sách hiển thị ngay dưới, cùng một link (ngoại lệ alt trong CLAUDE.md)
            <Image
              src={book.cover_url}
              alt=""
              fill
              sizes={sizes}
              {...(preload ? { preload: true, fetchPriority: 'high' } : { loading: eager ? 'eager' : 'lazy' })}
              className={cn('object-cover', soldOut && 'opacity-40')}
            />
          ) : (
            <span className="flex h-full items-center justify-center text-subtle">
              <BookIcon aria-hidden className="size-8" />
            </span>
          )}
          {soldOut && (
            <span className="absolute top-2 left-2 rounded-sm bg-background/90 px-1.5 py-0.5 text-xs font-medium">
              {t('outOfStock')}
            </span>
          )}
        </div>
        {/* Giữ chỗ 2 dòng tên + 1 dòng tác giả để card cùng chiều cao và khớp skeleton */}
        <p className="mt-3 line-clamp-2 min-h-[2lh] text-sm font-medium">{book.title}</p>
        <p className="mt-1 line-clamp-1 min-h-[1lh] text-xs text-muted-foreground">{authors.join(', ')}</p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="sr-only">{t('price')}</span>
          <span className="font-semibold text-primary">{format.number(book.price, 'price')}</span>
          {discount !== null && book.original_price !== null && (
            <>
              <span className="sr-only">{t('originalPrice')}</span>
              <s className="text-xs text-subtle">{format.number(book.original_price, 'price')}</s>
              <span className="text-xs font-medium text-sale">{t('discount', { percent: discount })}</span>
            </>
          )}
        </p>
      </Link>
      <BlockedVeil />
    </div>
  )
}
