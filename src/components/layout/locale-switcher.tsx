'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { getPathname, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

type Pathname = keyof typeof routing.pathnames
type SlugPathname = Extract<Pathname, `${string}[slug]`>
type Query = Record<string, string[]>
type Labels = { short: string; full: string }

/** Chuyển sang ngôn ngữ còn lại, giữ nguyên trang, params và query */
export function LocaleSwitcher({ labels }: { labels: Labels }) {
  return (
    // useSearchParams cần Suspense để trang vẫn prerender được; fallback là cùng link nhưng chưa có query
    <Suspense fallback={<LocaleLink labels={labels} />}>
      <LocaleLinkWithQuery labels={labels} />
    </Suspense>
  )
}

function LocaleLinkWithQuery({ labels }: { labels: Labels }) {
  const searchParams = useSearchParams()
  const query: Query = {}
  for (const key of new Set(searchParams.keys())) query[key] = searchParams.getAll(key)
  return <LocaleLink labels={labels} query={query} />
}

function LocaleLink({ labels, query }: { labels: Labels; query?: Query }) {
  const locale = useLocale()
  const pathname = usePathname()
  const { slug } = useParams()
  const target = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale

  return (
    <a
      // Ngoại lệ (CLAUDE.md → Song ngữ): Link có prop `locale` luôn ép prefix nên en→vi ra `/vi?…` và client nav
      // giữ nguyên URL không canonical đó. getPathname không ép prefix → `/?…`; đổi ngôn ngữ thì tải lại cả trang.
      // eslint-disable-next-line no-restricted-syntax
      href={getPathname({ href: currentHref(pathname, slug, query), locale: target })}
      hrefLang={target}
      className={buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'text-xs font-semibold' })}
    >
      {labels.short}
      <span className="sr-only"> – {labels.full}</span>
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
