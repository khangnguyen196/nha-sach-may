import { XIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Link, type Href } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import {
  PAGE_SIZE,
  catalogHref,
  resolveSort,
  sortsFor,
  withParams,
  type CatalogBase,
  type CatalogContext,
} from '../catalog-params'
import type { BookCard } from '../queries'
import { BOOK_LANGUAGES, PRICE_RANGES, type CatalogParams } from '../schemas'
import { BookGrid } from './book-grid'
import { EmptyState } from './empty-state'
import { FilterSheet } from './filter-sheet'
import { Pagination } from './pagination'
import { SortSelect } from './sort-select'

export type CatOption = { slug: string; label: string }

type Props = {
  params: CatalogParams
  context: CatalogContext
  base: CatalogBase
  result: { books: BookCard[]; total: number }
  /** Danh mục cha: chip danh mục con (`?cat=`), luôn hiện kể cả mobile vì là điều hướng chính */
  subcategories?: CatOption[]
  /** false = không có bộ lọc (trang tác giả). `cats` = nhóm lọc danh mục (trang tìm kiếm). */
  filters: false | { cats?: CatOption[] }
  /** Trạng thái rỗng khi không có bộ lọc nào */
  empty: { title: string; description?: string }
}

type FilterGroup = { key: string; label: string; options: { label: string; href: Href; active: boolean }[] }

export async function CatalogView({ params, context, base, result, subcategories, filters, empty }: Props) {
  const t = await getTranslations('catalog')
  const href = (patch: Partial<CatalogParams>) => catalogHref(base, withParams(params, patch), context)

  // Ở trang danh mục, `cat` là điều hướng (chip danh mục con) nên "Xóa bộ lọc" giữ nguyên nó
  const catIsFilter = Boolean(filters && filters.cats)
  const clearPatch: Partial<CatalogParams> = {
    price: undefined,
    lang: undefined,
    stock: undefined,
    ...(catIsFilter && { cat: undefined }),
  }
  const activeCount = [catIsFilter && params.cat, params.price, params.lang, params.stock].filter(Boolean).length

  const groups: FilterGroup[] = []
  if (filters) {
    if (filters.cats && filters.cats.length > 0) {
      groups.push({
        key: 'cat',
        label: t('filterGroups.cat'),
        options: filters.cats.map((cat) => ({
          label: cat.label,
          active: params.cat === cat.slug,
          href: href({ cat: params.cat === cat.slug ? undefined : cat.slug }),
        })),
      })
    }
    groups.push(
      {
        key: 'price',
        label: t('filterGroups.price'),
        options: PRICE_RANGES.map((price) => ({
          label: t(`price.${price}`),
          active: params.price === price,
          href: href({ price: params.price === price ? undefined : price }),
        })),
      },
      {
        key: 'lang',
        label: t('filterGroups.lang'),
        options: BOOK_LANGUAGES.map((lang) => ({
          label: t(`lang.${lang}`),
          active: params.lang === lang,
          href: href({ lang: params.lang === lang ? undefined : lang }),
        })),
      },
      {
        key: 'stock',
        label: t('filterGroups.stock'),
        options: [
          { label: t('inStock'), active: Boolean(params.stock), href: href({ stock: params.stock ? undefined : '1' }) },
        ],
      },
    )
  }

  const sort = resolveSort(params, context)
  const sortOptions = sortsFor(context).map((value) => ({ value, label: t(`sort.${value}`), href: href({ sort: value }) }))
  const totalPages = Math.ceil(result.total / PAGE_SIZE)
  const clearTextLink = (
    <Link
      href={href(clearPatch)}
      className="shrink-0 rounded-sm text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {t('clearFilters')}
    </Link>
  )
  const clearLink = (
    <Link href={href(clearPatch)} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
      <XIcon aria-hidden />
      {t('clearFilters')}
    </Link>
  )

  return (
    <div>
      {subcategories && subcategories.length > 0 && (
        <nav aria-label={t('subcategories')} className="-mx-4 mb-6 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          <ul className="flex w-max gap-2">
            <li>
              <Chip href={href({ cat: undefined })} active={!params.cat}>
                {t('allInCategory')}
              </Chip>
            </li>
            {subcategories.map((cat) => (
              <li key={cat.slug}>
                <Chip href={href({ cat: cat.slug })} active={params.cat === cat.slug}>
                  {cat.label}
                </Chip>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mb-6 flex min-h-9 flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          {t('resultCount', { count: result.total })}
        </p>
        <div className="flex items-center gap-2">
          {groups.length > 0 && (
            <FilterSheet
              labels={{ trigger: t('filtersActive', { count: activeCount }), title: t('filters'), close: t('close') }}
            >
              <FilterGroups groups={groups} />
              {activeCount > 0 && <div className="mt-6">{clearTextLink}</div>}
            </FilterSheet>
          )}
          <SortSelect label={t('sortLabel')} value={sort} options={sortOptions} />
        </div>
      </div>

      {groups.length > 0 && (
        <div className="mb-8 hidden items-start justify-between gap-6 md:flex">
          <FilterGroups groups={groups} />
          {activeCount > 0 && clearTextLink}
        </div>
      )}

      {result.books.length > 0 ? (
        <BookGrid books={result.books} />
      ) : activeCount > 0 ? (
        <EmptyState
          title={t('emptyFiltered.title')}
          description={t('emptyFiltered.description')}
          action={clearLink}
        />
      ) : (
        <EmptyState title={empty.title} description={empty.description} />
      )}

      <Pagination page={params.page} totalPages={totalPages} hrefFor={(page) => href({ page })} />
    </div>
  )
}

function FilterGroups({ groups }: { groups: FilterGroup[] }) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:flex-wrap md:items-center md:gap-x-8 md:gap-y-3">
      {groups.map((group) => (
        // aria-label thay vì aria-labelledby: nhóm filter render hai nơi (hàng desktop + sheet mobile) → tránh trùng id
        <div
          key={group.key}
          role="group"
          aria-label={group.label}
          className="flex flex-col gap-2 md:flex-row md:items-center"
        >
          <span aria-hidden className="text-xs font-medium text-subtle">
            {group.label}
          </span>
          <ul className="flex flex-wrap gap-2">
            {group.options.map((option) => (
              <li key={option.label}>
                <Chip href={option.href} active={option.active}>
                  {option.label}
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Chip({ href, active, children }: { href: Href; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex h-8 items-center rounded-full border px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-input text-muted-foreground hover:bg-surface-raised hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
