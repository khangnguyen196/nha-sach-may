import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

/**
 * UI 404 trong một boundary đã stream (trang lưới `?page=` vượt quá, đơn không thuộc người đang đăng nhập). Proxy
 * trả 404 thật cho các trường hợp này trước khi render; khối này chỉ là dự phòng khi proxy không hỏi được (lỗi mạng).
 * Không gọi `notFound()` ở đây: throw sau static shell làm React bỏ SSR của boundary (console: React error #419) rồi
 * dựng lại ở client. HTTP vẫn 200 (soft 404); React đưa `<meta>` lên `<head>`.
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
