'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useLocale, type Locale } from 'next-intl'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { getPathname, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { currentHref, type Params, type Query } from './locale-href'

type Labels = { short: string; full: string }

/**
 * Chuyển sang ngôn ngữ còn lại, giữ nguyên trang, params và query. Hai lớp Suspense:
 * - ngoài: App Shell của trang có slug chưa biết lúc build (useParams chưa có giá trị) → link về trang chủ của ngôn
 *   ngữ kia, thay bằng link đúng khi trang stream xong. Trang đã prerender không bao giờ thấy fallback này.
 * - trong: useSearchParams cần Suspense để trang vẫn prerender được; fallback là cùng link nhưng chưa có query. Đây
 *   là link trong HTML tĩnh, bấm được trước khi hydrate xong → inline script ngay sau nó gắn query hiện tại
 *   (location.search) vào href, không thì đổi ngôn ngữ sớm mất ?page=, ?q=…
 */
export function LocaleSwitcher({ labels }: { labels: Labels }) {
  return (
    <Suspense fallback={<LocaleAnchor labels={labels} href={(target) => getPathname({ href: '/', locale: target })} />}>
      <LocaleLinkWithParams labels={labels} />
    </Suspense>
  )
}

// Chạy lúc trình duyệt parse HTML, trước hydrate: link ngay trước script nhận query của URL hiện tại. Sau hydrate,
// Suspense của useSearchParams thay cả link lẫn script bằng link có query do React tính.
const PATCH_QUERY = `(()=>{const a=document.currentScript?.previousElementSibling;if(a instanceof HTMLAnchorElement&&location.search)a.search=location.search})()`

function LocaleLinkWithParams({ labels }: { labels: Labels }) {
  const params = useParams()
  return (
    <Suspense
      fallback={
        <>
          <LocaleLink labels={labels} params={params} />
          <script dangerouslySetInnerHTML={{ __html: PATCH_QUERY }} />
        </>
      }
    >
      <LocaleLinkWithQuery labels={labels} params={params} />
    </Suspense>
  )
}

function LocaleLinkWithQuery({ labels, params }: { labels: Labels; params: Params }) {
  const searchParams = useSearchParams()
  const query: Query = {}
  for (const key of new Set(searchParams.keys())) query[key] = searchParams.getAll(key)
  return <LocaleLink labels={labels} params={params} query={query} />
}

function LocaleLink({ labels, params, query }: { labels: Labels; params: Params; query?: Query }) {
  const pathname = usePathname()
  const { slug, id, code } = params
  return (
    <LocaleAnchor
      labels={labels}
      href={(target) => getPathname({ href: currentHref(pathname, { slug, id, code }, query), locale: target })}
    />
  )
}

function LocaleAnchor({ labels, href }: { labels: Labels; href: (target: Locale) => string }) {
  const locale = useLocale()
  const target = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale
  return (
    <a
      // Ngoại lệ (CLAUDE.md → Song ngữ): Link có prop `locale` luôn ép prefix nên en→vi ra `/vi?…` và client nav
      // giữ nguyên URL không canonical đó. getPathname không ép prefix → `/?…`; đổi ngôn ngữ thì tải lại cả trang.
      // eslint-disable-next-line no-restricted-syntax
      href={href(target)}
      // Link fallback bị inline script sửa href trước hydrate (PATCH_QUERY)
      suppressHydrationWarning
      hrefLang={target}
      className={buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'text-xs font-semibold' })}
    >
      {labels.short}
      <span className="sr-only"> – {labels.full}</span>
    </a>
  )
}
