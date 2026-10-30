import { ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { getFormatter, getTranslations } from 'next-intl/server'
import { GRID_CLASS } from '@/features/books/components/book-grid'
import { BlockedVeil } from '@/features/prefs/components/blocked-veil'
import { bookSlotAttributes } from '@/features/prefs/blocks'
import { Link } from '@/i18n/navigation'
import type { MarketListing } from '../public-queries'

/** sizes khớp lưới 2 / 3 / 4 / 5 / 6 cột (GRID_CLASS) trong khung max-w-6xl */
const MARKET_IMAGE_SIZES =
  '(min-width: 1280px) 176px, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw'
// Như BookGrid: hàng đầu tải ngay; 2 ảnh đầu (hàng đầu mobile) ưu tiên cao vì có thể là LCP
const EAGER_COUNT = 4
const PRELOAD_COUNT = 2

/** Lưới tin trên Chợ sách cũ. Ảnh khung 3:4 cố định (không CLS), link ký → next/image `unoptimized` (quyết định 7b) */
export async function MarketGrid({ listings }: { listings: MarketListing[] }) {
  const [t, tCondition, format] = await Promise.all([
    getTranslations('used.market'),
    getTranslations('used.condition'),
    getFormatter(),
  ])
  return (
    <ul className={GRID_CLASS} data-testid="market-listings">
      {listings.map((listing, index) => (
        <li key={listing.id} data-testid="market-listing" data-listing-id={listing.id}>
          {/* Khung thẻ mang khóa chặn của sách catalog của tin (như BookCard): BlockStyles che link + hiện ô mờ */}
          <div {...bookSlotAttributes(listing.book)} className="relative h-full">
            {/* Không prefetch: mỗi prefetch trang tin đi qua proxy, proxy đếm used_listings theo id để trả 404 thật → tới
                24 câu DB mỗi lần xem lưới */}
            <Link
              href={{ pathname: '/used-books/[id]', params: { id: String(listing.id) } }}
              prefetch={false}
              data-book-link
              className="group block rounded-lg transition-transform duration-200 ease-out outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-focus-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-cover border bg-surface-raised transition-shadow duration-200 ease-out group-hover:shadow-glow">
                {listing.photoUrl ? (
                  // alt rỗng: tên sách hiển thị ngay dưới, cùng một link (ngoại lệ alt trong CLAUDE.md)
                  <Image
                    src={listing.photoUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes={MARKET_IMAGE_SIZES}
                    {...(index < PRELOAD_COUNT
                      ? { preload: true, fetchPriority: 'high' }
                      : { loading: index < EAGER_COUNT ? 'eager' : 'lazy' })}
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center text-xs text-subtle">
                    <ImageIcon aria-hidden className="size-6" />
                    {t('noPhoto')}
                  </span>
                )}
              </div>
              {/* Giữ chỗ 2 dòng tên + 1 dòng tình trạng / giá / người bán để thẻ cùng chiều cao và khớp skeleton */}
              <p className="mt-3 line-clamp-2 min-h-[2lh] text-sm font-medium">{listing.book.title}</p>
              <p className="mt-1 line-clamp-1 min-h-[1lh] text-xs text-muted-foreground">{tCondition(listing.condition)}</p>
              <p className="mt-1.5 text-sm font-semibold text-primary tabular-nums" data-testid="market-listing-price">
                {format.number(listing.price, 'price')}
              </p>
              <p className="mt-1 line-clamp-1 min-h-[1lh] text-xs text-subtle" data-testid="market-listing-seller">
                {t('seller', { name: listing.sellerName ?? t('member') })}
              </p>
            </Link>
            <BlockedVeil />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Cùng khung với thẻ tin (ảnh 3:4, 2 dòng tên, tình trạng, giá, người bán) → không nhảy layout khi lưới stream vào */
export function MarketGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ul aria-hidden className={GRID_CLASS}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="aspect-[3/4] animate-pulse rounded-cover bg-surface-raised motion-reduce:animate-none" />
          <div className="mt-3 text-sm">
            <div className="flex h-[2lh] flex-col justify-around">
              <div className="h-3.5 animate-pulse rounded-sm bg-surface-raised motion-reduce:animate-none" />
              <div className="h-3.5 w-2/3 animate-pulse rounded-sm bg-surface-raised motion-reduce:animate-none" />
            </div>
          </div>
          <div className="mt-1 flex h-[1lh] items-center text-xs">
            <div className="h-3 w-1/3 animate-pulse rounded-sm bg-surface-raised motion-reduce:animate-none" />
          </div>
          <div className="mt-1.5 flex h-[1lh] items-center text-sm">
            <div className="h-3.5 w-1/3 animate-pulse rounded-sm bg-surface-raised motion-reduce:animate-none" />
          </div>
          <div className="mt-1 flex h-[1lh] items-center text-xs">
            <div className="h-3 w-1/2 animate-pulse rounded-sm bg-surface-raised motion-reduce:animate-none" />
          </div>
        </li>
      ))}
    </ul>
  )
}
