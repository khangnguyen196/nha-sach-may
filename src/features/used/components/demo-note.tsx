import { TriangleAlertIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

/**
 * "Tính năng demo, không có giao dịch thật" (quyết định của chủ dự án: form đăng tin, trang chợ, trang mua). Kiểu nhẹ như
 * WarningNotice (nền trung tính, icon màu nhấn), không dùng màu sale: lời nhắc thông tin, không phải lỗi. Tương phản: Vitest
 * src/app/globals.test.ts.
 */
export async function UsedDemoNote() {
  const t = await getTranslations('used.form')
  return (
    <p
      className="flex gap-2 rounded-lg border bg-surface-raised px-3 py-2.5 text-sm text-foreground"
      data-testid="used-demo-note"
    >
      <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      {t('demoNote')}
    </p>
  )
}
