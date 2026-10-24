import type { routing } from '@/i18n/routing'

// Tách khỏi locale-switcher.tsx (import i18n/navigation → next/root-params) để Vitest kiểm được
type Pathname = keyof typeof routing.pathnames
type SlugPathname = Extract<Pathname, `${string}[slug]`>
/** `[id]` ở cuối (/used-books/[id]) hoặc giữa (/used-books/[id]/buy) */
type IdPathname = Extract<Pathname, `${string}[id]${string}`>
type CodePathname = Extract<Pathname, `${string}[code]`>
export type Query = Record<string, string[]>

function isSlugPathname(pathname: Pathname): pathname is SlugPathname {
  return pathname.endsWith('[slug]')
}

function isIdPathname(pathname: Pathname): pathname is IdPathname {
  return pathname.includes('[id]')
}

function isCodePathname(pathname: Pathname): pathname is CodePathname {
  return pathname.endsWith('[code]')
}

export type Params = Partial<Record<string, string | string[]>>

// useParams() trả kiểu chung chung, còn Link đòi đúng params theo từng pathname → thu hẹp kiểu ở đây.
// Route động mới có param khác `slug` / `id` / `code` thì thêm nhánh tương ứng.
// Query rỗng → bỏ hẳn (getPathname với `query: {}` ra href có dấu ? thừa: /en?).
export function currentHref(pathname: Pathname, { slug, id, code }: Params, rawQuery: Query | undefined) {
  const query = rawQuery && Object.keys(rawQuery).length > 0 ? rawQuery : undefined
  if (isSlugPathname(pathname)) {
    if (typeof slug !== 'string') return { pathname: '/' as const }
    return { pathname, params: { slug }, query }
  }
  if (isIdPathname(pathname)) {
    if (typeof id !== 'string') return { pathname: '/' as const }
    return { pathname, params: { id }, query }
  }
  if (isCodePathname(pathname)) {
    if (typeof code !== 'string') return { pathname: '/' as const }
    return { pathname, params: { code }, query }
  }
  return { pathname, query }
}
