import { getTranslations } from 'next-intl/server'
import type { Database } from '@/types/database'

type UsedItem = {
  used_listing_id: number | null
  used_listings: { condition: Database['public']['Enums']['used_condition']; seller_name: string | null } | null
}

type Props = {
  item: UsedItem
  /** Admin: thêm "Người bán: <tên hiển thị>" (người mua chỉ thấy nhãn) */
  showSeller?: boolean
  className?: string
}

/**
 * Nhãn dòng sách cũ trong đơn: "Sách cũ · <tình trạng>". Tin không còn đọc được (đã rút sau khi đơn bị hủy: RLS chỉ cho
 * người mua đọc tin đã duyệt / đã bán) → chỉ "Sách cũ". Dòng sách mới → không render gì.
 */
export async function UsedItemLabel({ item, showSeller = false, className }: Props) {
  if (item.used_listing_id === null) return null
  const [t, tCondition, tMarket] = await Promise.all([
    getTranslations('used.order'),
    getTranslations('used.condition'),
    getTranslations('used.market'),
  ])
  const listing = item.used_listings
  return (
    <span className={className} data-testid="order-item-used">
      <span className="block">
        {listing ? t('usedLabel', { condition: tCondition(listing.condition) }) : t('usedLabelPlain')}
      </span>
      {showSeller && (
        <span className="block" data-testid="order-item-seller">
          {t('seller', { name: listing?.seller_name ?? tMarket('member') })}
        </span>
      )}
    </span>
  )
}
