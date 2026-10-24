import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import type { ListingStatus } from '../status'

// Chờ duyệt: màu nhấn nhạt; đang bán / đã bán: thành công; bị từ chối: màu lỗi; đã rút lùi về nền phụ
const TONE: Record<ListingStatus, string> = {
  pending: 'bg-primary/15 text-primary',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-destructive/15 text-destructive',
  sold: 'bg-success/15 text-success',
  withdrawn: 'bg-surface-raised text-muted-foreground',
}

export async function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const t = await getTranslations('used.status')
  return (
    <span
      className={cn('inline-flex shrink-0 rounded-sm px-2 py-0.5 text-xs font-medium', TONE[status])}
      data-testid="listing-status"
      data-status={status}
    >
      {t(status)}
    </span>
  )
}
