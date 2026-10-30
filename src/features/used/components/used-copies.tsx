import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getUsedCopies } from '../public-queries'

/**
 * Dòng giữ chỗ cao đúng một dòng chữ (có tin hay không, đang tải hay xong): khối mô tả bên dưới không nhảy (CLS).
 * min-h-[1lh] theo line-height thật của dòng: globals.css bỏ line-height đi kèm text-sm (`--text-*: initial`) nên dòng
 * thừa kế 1.6 của body (14px → 22.4px), min-h-5 (20px) thấp hơn dòng có link.
 */
const LINE = 'mt-4 min-h-[1lh] text-sm'

/**
 * "Có N bản cũ từ X ₫" dưới khối giá của trang sách, chỉ khi có ít nhất một tin đang bán. Link LUÔN tới danh sách chợ
 * lọc theo sách (`?book=<slug>`), không trỏ thẳng một tin (tin có thể bị bán / rút bất cứ lúc nào). Lỗi đọc → bỏ dòng
 * này, không làm hỏng trang sách.
 */
export async function UsedCopies({ bookId, slug }: { bookId: number; slug: string }) {
  const [copies, t, format] = await Promise.all([
    getUsedCopies(bookId).catch((error: unknown) => {
      console.error('UsedCopies:', error)
      return null
    }),
    getTranslations('book'),
    getFormatter(),
  ])
  return (
    <p className={LINE} data-testid="used-copies">
      {copies && (
        <Link
          href={{ pathname: '/used-books', query: { book: slug } }}
          className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus-ring"
        >
          {t('usedCopies', { count: copies.count, price: format.number(copies.minPrice, 'price') })}
        </Link>
      )}
    </p>
  )
}

export function UsedCopiesSkeleton() {
  return <p aria-hidden className={LINE} />
}
