import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

/**
 * UI 404 trong một boundary đã stream, HTTP 200 (soft 404); React đưa `<meta>` lên `<head>`. Dùng cho trang lưới
 * `?page=` vượt quá (không kiểm ở proxy: mỗi lượt kiểm thêm ~100 ms cho mọi trang > 1), danh sách đơn vượt quá, và làm
 * dự phòng cho trang một đơn khi proxy không hỏi được DB (bình thường proxy trả 404 thật).
 * Không gọi `notFound()` ở đây: throw sau static shell làm React bỏ SSR của boundary (console: React error #419) rồi
 * dựng lại ở client.
 */
export async function InlineNotFound() {
  const t = await getTranslations('notFound')
  return (
    <div className="flex flex-col items-start py-8">
      <meta name="robots" content="noindex" />
      <h2 className="font-serif text-2xl font-medium">{t('title')}</h2>
      <p className="mt-4 text-muted-foreground">{t('description')}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t('backHome')}</Link>
      </Button>
    </div>
  )
}
