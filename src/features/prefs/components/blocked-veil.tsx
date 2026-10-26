import { getTranslations } from 'next-intl/server'

/**
 * Ô mờ phủ đúng khung thẻ sách bị chặn (absolute inset-0 trong `[data-book-slot]`, cùng kích thước thẻ → không CLS).
 * Mặc định `display: none` bằng class (không dùng thuộc tính `hidden`: Tailwind v4 có `[hidden] { display: none
 * !important }`, CSS của BlockStyles không ghi đè được) → không hiện, không vào cây a11y; BlockStyles bật `display: flex`.
 * Nút "Xem": RevealBlocked bắt click ủy quyền trên document.
 */
export async function BlockedVeil() {
  const t = await getTranslations('prefs')
  return (
    <div
      data-book-veil
      className="absolute inset-0 hidden flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-surface p-3 text-center"
    >
      <p className="text-xs text-muted-foreground">{t('hidden')}</p>
      <button
        type="button"
        data-reveal
        className="rounded-md border px-3 py-1.5 text-sm font-medium outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t('reveal')}
      </button>
    </div>
  )
}
