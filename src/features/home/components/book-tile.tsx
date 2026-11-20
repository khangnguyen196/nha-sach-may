import { BookIcon } from 'lucide-react'
import Image from 'next/image'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { BookCard } from '@/features/books/queries'
import { discountPercent } from '@/features/books/utils'
import { BlockedVeil } from '@/features/prefs/components/blocked-veil'
import { bookSlotAttributes } from '@/features/prefs/blocks'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/**
 * Bề rộng ô bìa trong lưới 2×2 của thẻ: thẻ 78% màn (dưới sm), nửa hàng (sm–lg), một phần tư hàng max-w-6xl (từ lg),
 * trừ đệm thẻ 20px mỗi bên và khe 12px giữa hai cột
 */
const TILE_SIZES = '(min-width: 1024px) 112px, (min-width: 768px) 152px, 128px'

export type TileLoading = 'preload' | 'eager' | 'lazy'

/**
 * Một cuốn trong lưới 2×2 của thẻ khuyến mãi. Khung `[data-book-slot]` + BlockedVeil như BookCard (chặn theo sở thích:
 * <style> của BlockStyles che link, hiện ô mờ). Không nghiêng bìa (book-tilt chỉ cho thẻ ở kệ / lưới).
 * - `sale`: nhãn -X% trên bìa + giá; không có tên sách hiển thị → ảnh mang alt là tên sách (ảnh đứng một mình).
 * - `title`: tên sách dưới bìa (alt rỗng, ngoại lệ alt của CLAUDE.md).
 */
export async function BookTile({
  book,
  variant,
  loading,
}: {
  book: BookCard
  variant: 'sale' | 'title'
  loading: TileLoading
}) {
  const [t, format] = await Promise.all([getTranslations('book'), getFormatter()])
  const discount = discountPercent(book.price, book.original_price)
  const soldOut = book.stock <= 0

  return (
    <li {...bookSlotAttributes(book)} className="relative">
      <Link
        href={{ pathname: '/books/[slug]', params: { slug: book.slug } }}
        data-book-link
        // relative: sr-only (absolute) bên trong lấy link làm khung, không bị kéo ra ngoài vùng cuộn của hàng thẻ
        className="relative flex flex-col gap-1.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-focus-ring"
      >
        <span className="relative block aspect-[3/4] overflow-hidden rounded-cover bg-surface-raised after:pointer-events-none after:absolute after:inset-0 after:rounded-cover after:ring-1 after:ring-border after:ring-inset">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={variant === 'sale' ? book.title : ''}
              fill
              sizes={TILE_SIZES}
              {...(loading === 'preload'
                ? { preload: true, fetchPriority: 'high' }
                : { loading: loading === 'eager' ? 'eager' : 'lazy' })}
              className={cn('object-cover', soldOut && 'opacity-40')}
            />
          ) : (
            <span className="flex h-full items-center justify-center text-subtle">
              {variant === 'sale' && <span className="sr-only">{book.title}</span>}
              <BookIcon aria-hidden className="size-6" />
            </span>
          )}
          {variant === 'sale' && discount !== null && (
            <span className="absolute top-1.5 left-1.5 rounded-sm bg-sale px-1.5 text-xs font-semibold text-sale-foreground">
              {t('discount', { percent: discount })}
            </span>
          )}
          {soldOut && (
            <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-background/90 px-1.5 py-0.5 text-xs font-medium">
              {t('outOfStock')}
            </span>
          )}
        </span>
        {variant === 'sale' ? (
          <span className="flex flex-wrap items-baseline gap-x-1.5 text-sm leading-tight">
            <span className="sr-only">{t('price')}</span>
            <span className="font-semibold text-primary">{format.number(book.price, 'price')}</span>
            {book.original_price !== null && discount !== null && (
              <>
                <span className="sr-only">{t('originalPrice')}</span>
                <s className="text-xs text-subtle">{format.number(book.original_price, 'price')}</s>
              </>
            )}
          </span>
        ) : (
          <span className="line-clamp-2 min-h-[2lh] text-sm leading-tight">{book.title}</span>
        )}
      </Link>
      <BlockedVeil />
    </li>
  )
}
