import { TagIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/features/books/components/empty-state'
import { Pagination } from '@/features/books/components/pagination'
import { Link } from '@/i18n/navigation'
import { MARKET_PAGE_SIZE, searchTabQuery } from '../market-params'
import type { MarketListing } from '../public-queries'
import { MarketGrid } from './market-grid'

type Props = {
  raw: Record<string, string | string[] | undefined>
  /** Từ khóa đúng chữ người dùng gõ */
  typed: string
  page: number
  result: { listings: MarketListing[]; total: number }
}

/**
 * Tab Sách cũ của trang tìm kiếm: tin đang bán của các sách khớp từ khóa, cùng lưới với Chợ sách cũ (khung
 * [data-book-slot] + ô mờ chặn theo sở thích có sẵn trong MarketGrid). Không có bộ lọc / sắp xếp riêng (mới duyệt trước).
 */
export async function SearchUsedResults({ raw, typed, page, result }: Props) {
  const t = await getTranslations('searchPage')
  const base = searchTabQuery(raw, 'used')
  return (
    <>
      <h2 className="sr-only">{t('usedResultsFor', { q: typed })}</h2>
      <p role="status" className="mb-6 text-sm text-muted-foreground" data-testid="search-used-count">
        {t('usedCount', { count: result.total, q: typed })}
      </p>
      {result.listings.length > 0 ? (
        <MarketGrid listings={result.listings} />
      ) : (
        <div data-testid="search-used-empty">
          <EmptyState
            icon={TagIcon}
            title={t('usedEmpty.title', { q: typed })}
            description={t('usedEmpty.description')}
            action={
              <Link href="/used-books" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                {t('usedEmpty.action')}
              </Link>
            }
          />
        </div>
      )}
      <Pagination
        page={page}
        totalPages={Math.ceil(result.total / MARKET_PAGE_SIZE)}
        hrefFor={(target) => ({
          pathname: '/search',
          query: target > 1 ? { ...base, page: String(target) } : base,
        })}
      />
    </>
  )
}
