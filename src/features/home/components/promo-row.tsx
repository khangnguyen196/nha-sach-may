import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { ShelfNav } from '@/features/books/components/shelf-nav'
import type { BookCard } from '@/features/books/queries'
import type { Href } from '@/i18n/navigation'
import type { ShippingTerms } from '../queries'
import { BookTilesCard } from './book-tiles-card'
import type { TileLoading } from './book-tile'
import { ShipCard } from './ship-card'

const LIST_ID = 'promo-cards'
/** Ảnh của các thẻ đứng trước vị trí này tải ngay (màn đầu), thẻ sau tải lười */
const EAGER_CARDS = 3

type Props = {
  promo: { sale: BookCard[]; bestselling: BookCard[]; foreign: BookCard[] }
  shipping: ShippingTerms
  /** Kệ / danh mục "Sách ngoại văn" (tên đã dịch + link danh mục); không có nhánh này → không thẻ */
  foreign: { title: string; href: Href } | null
}

type Card = { key: string; render: (loading: TileLoading) => ReactNode }

/**
 * Hàng thẻ khuyến mãi đầu trang chủ (phương án A, docs/plans/trang-chu-khuyen-mai.md): Đang giảm giá, Miễn phí giao
 * hàng, Bán chạy, Sách ngoại văn. Thẻ thiếu sách thì ẩn. Không tự trượt, không chuyển động tự động: cuộn ngang bằng tay
 * (scroll-snap), nút trước / sau là ShelfNav của kệ (từ md, chỉ khi tràn, cuộn tức thì khi giảm chuyển động); bàn phím
 * Tab qua từng link, trình duyệt tự cuộn tới.
 */
export async function PromoRow({ promo, shipping, foreign }: Props) {
  const t = await getTranslations('home')

  const cards: Card[] = []
  if (promo.sale.length > 0) {
    cards.push({
      key: 'sale',
      render: (loading) => (
        <BookTilesCard
          id="promo-sale"
          title={t('saleTitle')}
          books={promo.sale}
          variant="sale"
          more={{ href: '/books', label: t('allBooks') }}
          loading={loading}
        />
      ),
    })
  }
  cards.push({ key: 'ship', render: () => <ShipCard id="promo-ship" terms={shipping} /> })
  if (promo.bestselling.length > 0) {
    cards.push({
      key: 'bestselling',
      render: (loading) => (
        <BookTilesCard
          id="promo-bestselling"
          title={t('bestselling')}
          books={promo.bestselling}
          variant="title"
          // /sach mặc định xếp theo bán chạy
          more={{ href: '/books', label: t('bestsellingMore') }}
          loading={loading}
        />
      ),
    })
  }
  if (foreign && promo.foreign.length > 0) {
    cards.push({
      key: 'foreign',
      render: (loading) => (
        <BookTilesCard
          id="promo-foreign"
          title={foreign.title}
          books={promo.foreign}
          variant="title"
          more={{ href: foreign.href, label: t('foreignMore') }}
          loading={loading}
        />
      ),
    })
  }
  // Bìa đầu tiên của thẻ có ảnh đầu tiên là ứng viên LCP (preload); các thẻ trong EAGER_CARDS tải ngay, còn lại lười
  const firstWithBooks = cards.findIndex((card) => card.key !== 'ship')
  const loadingOf = (index: number): TileLoading =>
    index === firstWithBooks ? 'preload' : index < EAGER_CARDS ? 'eager' : 'lazy'

  return (
    <section aria-labelledby="promo-title" className="pt-6">
      <h2 id="promo-title" className="sr-only">
        {t('promoTitle')}
      </h2>
      <div className="relative">
        {/* relative: phần tử absolute bên trong (sr-only) lấy danh sách làm khung, không kéo trang rộng ra (như kệ).
            Thẻ: 78% màn dưới sm (lộ mép thẻ sau → biết cuộn được), 2 thẻ sm–lg, 4 thẻ từ lg */}
        <ul
          id={LIST_ID}
          className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-1 pb-3 sm:-mx-6 sm:scroll-px-6 sm:px-6"
        >
          {cards.map((card, index) => (
            <li
              key={card.key}
              className="flex w-[78%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-3rem)/4)]"
            >
              {card.render(loadingOf(index))}
            </li>
          ))}
        </ul>
        {/* Nút của kệ (ShelfNav) đặt hai bên hàng thẻ như mẫu A: khung không nhận chuột, chỉ nút nhận; nút disabled giữ
            pointer-events: none của Button */}
        <div className="pointer-events-none absolute -inset-x-5 top-1/2 -translate-y-1/2 [&_button]:pointer-events-auto [&_button]:rounded-full [&_button]:border [&_button]:border-input [&_button]:bg-surface [&_button]:shadow-sm [&>div]:justify-between">
          <ShelfNav
            listId={LIST_ID}
            labels={{ previous: t('promoPrevious'), next: t('promoNext') }}
            icons={{ previous: <ChevronLeftIcon aria-hidden />, next: <ChevronRightIcon aria-hidden /> }}
          />
        </div>
      </div>
    </section>
  )
}
