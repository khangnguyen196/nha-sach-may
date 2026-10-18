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
 * - ngoài: useParams chưa có giá trị khi HTML tĩnh được gửi (App Shell của slug chưa biết lúc build, và cả trang đã
 *   prerender như `/`: CI thấy fallback này trong HTML, nội dung thật tới sau trong `<div hidden id="S:…">`) → link về
 *   trang chủ của ngôn ngữ kia. Fallback nằm ngoài Suspense nên không đọc được URL (usePathname ở đây làm App Shell lỗi);
 *   đang ở trang chủ thì script ngay sau link gắn query hiện tại (đổi ngôn ngữ ở `/?x=1` sớm từng mất `?x=1`).
 * - trong: useSearchParams cần Suspense để trang vẫn prerender được; fallback là cùng link nhưng chưa có query.
 * Cả hai fallback là link trong HTML tĩnh, bấm được trước khi hydrate / stream xong → inline script ngay sau link gắn
 * query hiện tại (location.search) vào href, không thì đổi ngôn ngữ sớm mất ?page=, ?q=…
 */
export function LocaleSwitcher({ labels }: { labels: Labels }) {
  return (
    <Suspense
      fallback={
        <>
          <LocaleAnchor labels={labels} href={(target) => getPathname({ href: '/', locale: target })} />
          <script dangerouslySetInnerHTML={{ __html: PATCH_HOME_QUERY }} />
        </>
      }
    >
      <LocaleLinkWithParams labels={labels} />
    </Suspense>
  )
}

// Chạy lúc trình duyệt parse HTML, trước hydrate: link ngay trước script nhận query của URL hiện tại. Sau hydrate,
// Suspense của useSearchParams thay cả link lẫn script bằng link có query do React tính.
const PATCH_QUERY = `(()=>{const a=document.currentScript?.previousElementSibling;if(a instanceof HTMLAnchorElement&&location.search)a.search=location.search})()`

// Như PATCH_QUERY nhưng chỉ khi đang ở trang chủ (link của fallback ngoài luôn trỏ trang chủ ngôn ngữ kia)
const HOME_PATHS = JSON.stringify(routing.locales.map((locale) => getPathname({ href: '/', locale })))
const PATCH_HOME_QUERY = `(()=>{const a=document.currentScript?.previousElementSibling;if(a instanceof HTMLAnchorElement&&location.search&&${HOME_PATHS}.includes(location.pathname))a.search=location.search})()`

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
