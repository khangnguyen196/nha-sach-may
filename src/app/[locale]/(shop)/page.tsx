import { getLocale, getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { Shelf, type ShelfChips } from '@/features/books/components/shelf'
import { getCategories, getCategoryShelf, getHomeShelves, type Category } from '@/features/books/queries'
import { visibleCategoryIds } from '@/features/books/utils'
import { PromoRow } from '@/features/home/components/promo-row'
import { getShippingTermsOrNull } from '@/features/home/queries'
import { ClockFace } from '@/features/store/components/clock-face'
import { StoreClock } from '@/features/store/components/store-clock'
import { Link, type Href } from '@/i18n/navigation'
import { localizedPath } from '@/i18n/paths'
import { localize } from '@/lib/i18n-db'
import { serializeJsonLd, websiteJsonLd } from '@/lib/json-ld'
import { siteUrl } from '@/lib/site-url'
import { placeholder } from '@/lib/template'

/** Nhánh danh mục sách tiếng Anh (supabase/seed-foreign-books.sql): một kệ riêng, không trộn vào "Mới về" */
const FOREIGN_CATEGORY_SLUG = 'sach-ngoai-van'

/** Sách chỉ gắn vào danh mục lá: danh mục cha → id các danh mục con */
function leafIds(categories: Category[], root: Category) {
  const children = categories.filter((c) => c.parent_id === root.id)
  return children.length > 0 ? children.map((c) => c.id) : [root.id]
}

/**
 * Hàng thẻ khuyến mãi (Đang giảm giá, Miễn phí giao hàng, Bán chạy, Sách ngoại văn) → dải đồng hồ giờ VN / trạng thái cửa
 * hàng + 1 CTA → kệ Nổi bật, Bán chạy, Mới về (sách tiếng Việt), Sách ngoại văn → kệ danh mục (mỗi danh mục cha đang
 * hiện một kệ, theo sort_order, trừ Sách ngoại văn; kèm hàng chip danh mục con).
 * Prerender: mọi query qua 'use cache' + client anon. LCP là bìa đầu của thẻ đầu (preload); ảnh 3 thẻ đầu tải ngay,
 * thẻ sau và kệ lazy.
 */
export default async function HomePage() {
  const [t, tCommon, tCatalog, locale, categories, shipping] = await Promise.all([
    getTranslations('home'),
    getTranslations('common'),
    getTranslations('catalog'),
    getLocale(),
    getCategories(),
    // Lỗi → null: chỉ ẩn thẻ "Miễn phí giao hàng", trang chủ vẫn hiện
    getShippingTermsOrNull(),
  ])
  const visibleIds = visibleCategoryIds(categories)
  const visible = new Set(visibleIds)
  const foreignRoot = categories.find((c) => c.slug === FOREIGN_CATEGORY_SLUG)
  const shelfParents = categories.filter((c) => c.parent_id === null && c.slug !== FOREIGN_CATEGORY_SLUG)
  // Mỗi kệ danh mục một cache riêng (giới hạn 128 tag / cache), chạy song song cùng các kệ trên
  const [shelves, ...categoryBooks] = await Promise.all([
    getHomeShelves(visibleIds, foreignRoot ? leafIds(categories, foreignRoot) : []),
    ...shelfParents.map((parent) => getCategoryShelf(leafIds(categories, parent).filter((id) => visible.has(id)))),
  ])
  const categoryHref = (category: Category): Href => ({
    pathname: '/categories/[slug]',
    params: { slug: category.slug },
  })
  const chipsFor = (parent: Category): ShelfChips => ({
    navLabel: tCatalog('shelfSubcategories', { category: localize(parent, 'name', locale) }),
    items: categories
      .filter((child) => child.parent_id === parent.id)
      .map((child) => ({ href: categoryHref(child), label: localize(child, 'name', locale) })),
  })
  // Thẻ + kệ "Sách ngoại văn" dùng chung tên và link danh mục
  const foreign: { title: string; href: Href } | null = foreignRoot
    ? { title: localize(foreignRoot, 'name', locale), href: categoryHref(foreignRoot) }
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
      <PromoRow promo={shelves.promo} shipping={shipping} foreign={foreign} />
      {/* Dải đồng hồ + CTA. Dưới sm: lưới 2 cột, mặt đồng hồ + nút ở hàng 1, dòng giờ ở hàng 2 đủ cả bề rộng (một dòng ở
          màn 320px, e2e store-clock); từ sm: một hàng. Khung của StoreClock là display: contents để mặt đồng hồ và dòng
          giờ thành ô của lưới / hàng (cỡ mặt và vị trí dòng giờ qua faceClassName / lineClassName) */}
      <div
        data-testid="home-strip"
        className="mt-5 grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 border-y py-4 sm:flex sm:gap-4"
      >
        <StoreClock
          className="contents"
          faceClassName="size-12 shrink-0"
          lineClassName="col-span-2 row-start-2 sm:flex-1"
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

      <div className="mt-12 space-y-12 pb-12 md:mt-20 md:space-y-20 md:pb-20">
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
        {foreignRoot && foreign && (
          <Shelf
            id="foreign-books"
            title={foreign.title}
            href={foreign.href}
            books={shelves.foreign}
            chips={chipsFor(foreignRoot)}
          />
        )}
        {/* Neo của link "Xem danh mục" ở trang 404 (not-found-view.tsx). Kệ < 4 sách tự ẩn (getCategoryShelf) */}
        <div id="categories" className="space-y-12 md:space-y-20">
          {shelfParents.map((parent, index) => (
            <Shelf
              key={parent.id}
              id={`category-${parent.slug}`}
              title={localize(parent, 'name', locale)}
              href={categoryHref(parent)}
              books={categoryBooks[index] ?? []}
              chips={chipsFor(parent)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
