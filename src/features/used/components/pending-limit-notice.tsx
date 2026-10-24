import { getTranslations } from 'next-intl/server'

/** Đủ 10 tin chờ duyệt: chưa đăng tin mới được (RPC cũng chặn, LISTING_PENDING_LIMIT) */
export async function PendingLimitNotice() {
  const [t, tErrors] = await Promise.all([getTranslations('used.myListings'), getTranslations('errors')])
  return (
    <div className="rounded-lg border bg-surface p-4 text-sm" data-testid="pending-limit">
      <p className="font-medium">{t('pendingLimitTitle')}</p>
      <p className="mt-1 text-muted-foreground">{tErrors('LISTING_PENDING_LIMIT')}</p>
    </div>
  )
}
