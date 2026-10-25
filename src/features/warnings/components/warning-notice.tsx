import { InfoIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { CONTENT_WARNINGS, type ContentWarning } from '../labels'

/**
 * Khung cảnh báo nội dung ở trang sách: nhãn admin đã duyệt (books.content_warnings), theo thứ tự enum. Server Component,
 * render cùng lần với mô tả từ cùng dữ liệu cache của sách (tag book:{id}): có mặt ngay trong HTML, không Suspense riêng,
 * không JS → không CLS. Không có nhãn → không render gì. Có nhãn tự hại → thêm một câu nhẹ nhàng (không số điện thoại,
 * không dùng lại chat.crisis). Màu trung tính (surface-raised), không dùng màu sale.
 */
export async function WarningNotice({ labels }: { labels: readonly ContentWarning[] }) {
  const shown = CONTENT_WARNINGS.filter((label) => labels.includes(label))
  if (shown.length === 0) return null
  const t = await getTranslations('contentWarnings')

  return (
    <div
      role="note"
      aria-labelledby="content-warnings-title"
      className="mt-10 max-w-reading rounded-lg border bg-surface-raised p-4 md:p-5"
      data-testid="content-warnings"
    >
      <h2 id="content-warnings-title" className="flex items-center gap-2 text-base font-semibold">
        <InfoIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        {t('notice.title')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('notice.intro')}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {shown.map((label) => (
          <li key={label}>{t(`labels.${label}`)}</li>
        ))}
      </ul>
      {shown.includes('self_harm') && <p className="mt-3 text-sm">{t('selfHarmNote')}</p>}
    </div>
  )
}
