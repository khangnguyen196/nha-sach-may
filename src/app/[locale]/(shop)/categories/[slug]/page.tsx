import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { resolveSort } from '@/features/books/catalog-params'
import { CatalogSkeleton } from '@/features/books/components/book-grid-skeleton'
import { Breadcrumb, type Crumb } from '@/features/books/components/breadcrumb'
import { CatalogView } from '@/features/books/components/catalog-view'
import { getCategories, getCategoryBySlug, listBooks, type Category } from '@/features/books/queries'
import { catalogParamsSchema } from '@/features/books/schemas'
import { localeAlternates } from '@/i18n/alternates'
import { localize } from '@/lib/i18n-db'

type Props = PageProps<'/[locale]/categories/[slug]'>

// Slug tạo sau lần build (admin thêm / đổi slug, import giữa hai lần deploy) không có trong generateStaticParams: Next
// dựng App Shell cho tham số chưa biết, mà page đọc params và header (LocaleSwitcher đọc useParams) nằm ngoài
// <Suspense> → không dựng được → HTTP 500. Cho phép route chặn: slug mới render theo request, slug đã prerender giữ nguyên.
export const instant = false

export async function generateStaticParams() {
  const categories = await getCategories()
  return categories.map((category) => ({ slug: category.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [category, locale, t] = await Promise.all([getCategoryBySlug(slug), getLocale(), getTranslations('catalog')])
  if (!category) return {}
  const name = localize(category, 'name', locale)
  return {
    title: name,
    description: localize(category, 'description', locale) ?? t('categoryMetaDescription', { name }),
    alternates: localeAlternates({ pathname: '/categories/[slug]', params: { slug } }, locale),
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const [categories, locale] = await Promise.all([getCategories(), getLocale()])
  const category = categories.find((c) => c.slug === slug)
  if (!category) notFound()

  const parent = categories.find((c) => c.id === category.parent_id)
  const subcategories = categories.filter((c) => c.parent_id === category.id)
  const name = localize(category, 'name', locale)
  const description = localize(category, 'description', locale)
  const crumbs: Crumb[] = parent
    ? [{ label: localize(parent, 'name', locale), href: { pathname: '/categories/[slug]', params: { slug: parent.slug } } }]
    : []
  crumbs.push({ label: name })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <Breadcrumb items={crumbs} />
      <header className="mt-6 mb-8 md:mb-10">
        <h1 className="font-serif text-3xl font-medium md:text-4xl">{name}</h1>
        {description && <p className="mt-3 max-w-reading text-muted-foreground">{description}</p>}
      </header>

      {/* Phần đọc searchParams (filter, sort, trang) stream sau; tiêu đề và mô tả ở trên prerender sẵn */}
      <Suspense fallback={<CatalogSkeleton withChips={subcategories.length > 0} />}>
        <CategoryResults
          category={category}
          subcategories={subcategories}
          locale={locale}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  )
}

type ResultsProps = {
  category: Category
  subcategories: Category[]
  locale: Locale
  searchParams: Props['searchParams']
}

async function CategoryResults({ category, subcategories, locale, searchParams }: ResultsProps) {
  const [raw, t] = await Promise.all([searchParams, getTranslations('catalog')])
  const parsed = catalogParamsSchema.parse(raw)
  // `cat` chỉ nhận danh mục con của chính danh mục này; slug khác → bỏ qua như không có
  const selected = subcategories.find((c) => c.slug === parsed.cat)
  const params = selected ? parsed : { ...parsed, cat: undefined }
  // Sách chỉ gắn vào danh mục lá: danh mục cha lọc theo id các danh mục con
  const categoryIds = selected ? [selected.id] : subcategories.length > 0 ? subcategories.map((c) => c.id) : [category.id]

  const result = await listBooks({
    categoryIds,
    price: params.price,
    lang: params.lang,
    inStock: Boolean(params.stock),
    sort: resolveSort(params, 'browse'),
    page: params.page,
  })
  // Không dựa vào count 'estimated': trang > 1 mà không có dòng nào là trang không tồn tại
  if (params.page > 1 && result.books.length === 0) notFound()

  return (
    <CatalogView
      params={params}
      context="browse"
      base={{ pathname: '/categories/[slug]', params: { slug: category.slug } }}
      result={result}
      subcategories={subcategories.map((c) => ({ slug: c.slug, label: localize(c, 'name', locale) }))}
      filters={{}}
      empty={{ title: t('empty.title'), description: t('empty.description') }}
    />
  )
}
