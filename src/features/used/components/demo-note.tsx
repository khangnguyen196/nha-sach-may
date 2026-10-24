import { TriangleAlertIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

/** "Tính năng demo, không có giao dịch thật" (quyết định của chủ dự án: form đăng tin, trang chợ, trang mua) */
export async function UsedDemoNote() {
  const t = await getTranslations('used.form')
  return (
    <p
      className="flex gap-2 rounded-md border border-sale/40 bg-sale/10 px-3 py-2.5 text-sm text-sale"
      data-testid="used-demo-note"
    >
      <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      {t('demoNote')}
    </p>
  )
}
