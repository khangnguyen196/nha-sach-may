'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { getPathname, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

type Pathname = keyof typeof routing.pathnames
type SlugPathname = Extract<Pathname, `${string}[slug]`>
type Query = Record<string, string[]>

/** Chuyển sang ngôn ngữ còn lại, giữ nguyên trang, params và query */
export function LocaleSwitcher() {
  return (
    // useSearchParams cần Suspense để trang vẫn prerender được; fallback là cùng link nhưng chưa có query
    <Suspense fallback={<LocaleLink />}>
      <LocaleLinkWithQuery />
    </Suspense>
  )
}

function LocaleLinkWithQuery() {
  const searchParams = useSearchParams()
  const query: Query = {}
  for (const key of new Set(searchParams.keys())) query[key] = searchParams.getAll(key)
  return <LocaleLink query={query} />
}

function LocaleLink({ query }: { query?: Query }) {
  const t = useTranslations('layout')
  const locale = useLocale()
  const pathname = usePathname()
  const { slug } = useParams()
  const target = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale

  // <a> thường thay vì Link: Link có prop `locale` luôn ép prefix (`/vi?…`), client nav giữ nguyên URL đó
  // thay vì `/?…`. Đổi ngôn ngữ thì mọi nội dung đều đổi nên tải lại cả trang là hợp lý.
  return (
    <a
      href={getPathname({ href: currentHref(pathname, slug, query), locale: target })}
      hrefLang={target}
      className={buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'text-xs font-semibold' })}
    >
      {t('switchLocaleShort')}
      <span className="sr-only"> – {t('switchLocale')}</span>
    </a>
  )
}

function isSlugPathname(pathname: Pathname): pathname is SlugPathname {
  return pathname.endsWith('[slug]')
}

// useParams() trả kiểu chung chung, còn Link đòi đúng params theo từng pathname → thu hẹp kiểu ở đây.
// Route động mới có param khác `slug` thì thêm nhánh tương ứng.
function currentHref(pathname: Pathname, slug: string | string[] | undefined, query: Query | undefined) {
  if (!isSlugPathname(pathname)) return { pathname, query }
  if (typeof slug !== 'string') return { pathname: '/' as const }
  return { pathname, params: { slug }, query }
}
