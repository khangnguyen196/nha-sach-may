import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { searchTabHref, type SearchTab } from '../market-params'

type Props = {
  /** searchParams thô của trang tìm kiếm: link giữ q đúng chữ đã gõ + bộ lọc / sắp xếp */
  raw: Record<string, string | string[] | undefined>
  active: SearchTab
  /**
   * Số tin sách cũ đang bán của các sách khớp (tính cả tin của sách bị chặn theo sở thích, như mọi bộ đếm khác);
   * null = đếm lỗi ở tab Sách mới → nhãn "Sách cũ" không số
   */
  usedCount: number | null
}

const TAB_CLASS =
  'inline-flex h-11 items-center rounded-t-sm border-b-2 px-1 text-sm font-medium outline-none transition-colors duration-150 ease-out focus-visible:ring-3 focus-visible:ring-focus-ring motion-reduce:transition-none'

/**
 * Dải tab Sách mới | Sách cũ (N) của trang tìm kiếm. Link thật trên URL (`type=used`), tab đang chọn mang
 * aria-current="page" (điều hướng giữa hai trang kết quả, không phải tablist của ARIA). Chiều cao = SearchTabsSkeleton.
 */
export async function SearchTabs({ raw, active, usedCount }: Props) {
  const t = await getTranslations('searchPage')
  const tabs = [
    { tab: 'new', label: t('tabNew') },
    { tab: 'used', label: usedCount === null ? t('tabUsedPlain') : t('tabUsed', { count: usedCount }) },
  ] as const
  return (
    <nav aria-label={t('tabsLabel')} className="mb-6 border-b" data-testid="search-tabs">
      <ul className="-mb-px flex gap-6">
        {tabs.map(({ tab, label }) => (
          <li key={tab}>
            <Link
              href={searchTabHref(raw, tab)}
              aria-current={tab === active ? 'page' : undefined}
              data-tab={tab}
              className={cn(
                TAB_CLASS,
                tab === active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="tabular-nums">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Giữ chỗ dải tab trong fallback của Suspense: cùng cao (44px gồm viền) và lề dưới với SearchTabs */
export function SearchTabsSkeleton() {
  return (
    <div aria-hidden className="mb-6 flex h-11 items-center gap-6 border-b">
      <div className="h-3.5 w-16 animate-pulse rounded-sm bg-surface-raised motion-reduce:animate-none" />
      <div className="h-3.5 w-20 animate-pulse rounded-sm bg-surface-raised motion-reduce:animate-none" />
    </div>
  )
}
