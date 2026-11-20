import { getLocale, getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { Shelf } from '@/features/books/components/shelf'
import { getCategories, getHomeShelves, type Category } from '@/features/books/queries'
import { visibleCategoryIds } from '@/features/books/utils'
import { PromoRow } from '@/features/home/components/promo-row'
import { getShippingTerms } from '@/features/home/queries'
import { ClockFace } from '@/features/store/components/clock-face'
import { StoreClock } from '@/features/store/components/store-clock'
import { Link, type Href } from '@/i18n/navigation'
import { localizedPath } from '@/i18n/paths'
import { localize } from '@/lib/i18n-db'
import { serializeJsonLd, websiteJsonLd } from '@/lib/json-ld'
import { siteUrl } from '@/lib/site-url'
import { placeholder } from '@/lib/template'

const categoryLink =
  'rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-focus-ring'

/** Nhánh danh mục sách tiếng Anh (supabase/seed-foreign-books.sql): một kệ riêng, không trộn vào "Mới về" */
const FOREIGN_CATEGORY_SLUG = 'sach-ngoai-van'

/** Sách chỉ gắn vào danh mục lá: danh mục cha → id các danh mục con */
function leafIds(categories: Category[], root: Category) {
  const children = categories.filter((c) => c.parent_id === root.id)
  return children.length > 0 ? children.map((c) => c.id) : [root.id]
}

/**
 * Hàng thẻ khuyến mãi (Đang giảm giá, Miễn phí giao hàng, Bán chạy, Sách ngoại văn) → dải đồng hồ giờ VN / trạng thái cửa
 * hàng + 1 CTA → kệ Nổi bật, Bán chạy, Mới về (sách tiếng Việt), Sách ngoại văn → lưới danh mục.
 * Prerender: mọi query qua 'use cache' + client anon. LCP là bìa đầu của thẻ đầu (preload); ảnh 3 thẻ đầu tải ngay,
 * thẻ sau và kệ lazy.
 */
export default async function HomePage() {
  const [t, tCommon, locale, categories, shipping] = await Promise.all([
    getTranslations('home'),
    getTranslations('common'),
    getLocale(),
    getCategories(),
    getShippingTerms(),
  ])
  const foreignRoot = categories.find((c) => c.slug === FOREIGN_CATEGORY_SLUG)
  const shelves = await getHomeShelves(
    visibleCategoryIds(categories),
    foreignRoot ? leafIds(categories, foreignRoot) : [],
  )
  const parents = categories.filter((c) => c.parent_id === null)
  // Thẻ + kệ "Sách ngoại văn" dùng chung tên và link danh mục
  const foreign: { title: string; href: Href } | null = foreignRoot
    ? {
        title: localize(foreignRoot, 'name', locale),
        href: { pathname: '/categories/[slug]', params: { slug: foreignRoot.slug } },
      }
    : null

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            websiteJsonLd({
              name: tCommon('siteName'),
              url: `${siteUrl()}${localizedPath('/', locale)}`,
              searchUrl: `${siteUrl()}${localizedPath('/search', locale)}`,
            }),
          ),
        }}
      />
      {/* Trang chủ không có tiêu đề hiển thị (mở đầu bằng hàng thẻ khuyến mãi): h1 ẩn cho trình đọc màn hình / dàn ý */}
      <h1 className="sr-only">{t('title')}</h1>
      <PromoRow
        promo={shelves.promo}
        shipping={shipping}
        foreign={foreign}
      />
      {/* Dải đồng hồ + CTA. Dưới sm: lưới 2 cột, mặt đồng hồ + nút ở hàng 1, dòng giờ ở hàng 2 đủ cả bề rộng (một dòng ở
          màn 320px, e2e store-clock); từ sm: một hàng. Khung của StoreClock là display: contents để mặt đồng hồ và dòng
          giờ thành ô của lưới / hàng (StoreClock giữ nguyên, chỉ đổi cỡ mặt và lề bằng selector con) */}
      <div
        data-testid="home-strip"
        className="mt-5 grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 border-y py-4 sm:flex sm:gap-4"
      >
        <StoreClock
          className="contents [&_[data-testid=store-clock]]:col-span-2 [&_[data-testid=store-clock]]:row-start-2 [&_[data-testid=store-clock]]:mt-0 sm:[&_[data-testid=store-clock]]:flex-1 [&_[data-testid=store-clock-face]]:size-12 [&_[data-testid=store-clock-face]]:shrink-0"
          timeTemplate={t('clockTime', { time: placeholder('time') })}
          openLabel={t('storeOpen')}
          closedLabel={t('storeClosed')}
          locale={locale}
        >
          <ClockFace />
        </StoreClock>
        <Link
          href="/books"
          className={buttonVariants({ size: 'lg', className: 'col-start-2 row-start-1 h-11 px-6 text-base sm:shrink-0' })}
        >
          {t('allBooks')}
        </Link>
      </div>

      <div className="mt-12 space-y-12 md:mt-20 md:space-y-20">
        <Shelf id="featured" title={t('featured')} books={shelves.featured} />
        <Shelf id="bestselling" title={t('bestselling')} href="/books" books={shelves.bestselling} />
        {shelves.newArrivals.length > 0 ? (
          <Shelf
            id="new-arrivals"
            title={t('newArrivals')}
            href={{ pathname: '/books', query: { lang: 'vi', sort: 'newest' } }}
            books={shelves.newArrivals}
          />
        ) : (
          <section aria-labelledby="new-arrivals">
            <h2 id="new-arrivals" className="text-xl font-semibold">
              {t('newArrivals')}
            </h2>
            <p className="mt-4 text-muted-foreground">{t('newArrivalsEmpty')}</p>
          </section>
        )}
        {foreign && <Shelf id="foreign-books" title={foreign.title} href={foreign.href} books={shelves.foreign} />}
      </div>

      <section aria-labelledby="categories-title" className="py-12 md:py-20">
        <h2 id="categories-title" className="text-xl font-semibold">
          {t('categoriesTitle')}
        </h2>
        {parents.length === 0 ? (
          <p className="mt-4 text-muted-foreground">{t('categoriesEmpty')}</p>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {parents.map((parent) => (
              <li key={parent.id} className="rounded-lg border bg-surface p-4">
                <Link
                  href={{ pathname: '/categories/[slug]', params: { slug: parent.slug } }}
                  className={`font-medium ${categoryLink}`}
                >
                  {localize(parent, 'name', locale)}
                </Link>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {categories
                    .filter((child) => child.parent_id === parent.id)
                    .map((child) => (
                      <li key={child.id}>
                        <Link
                          href={{ pathname: '/categories/[slug]', params: { slug: child.slug } }}
                          className={categoryLink}
                        >
                          {localize(child, 'name', locale)}
                        </Link>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
