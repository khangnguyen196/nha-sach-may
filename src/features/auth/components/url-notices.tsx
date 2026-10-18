import { getTranslations } from 'next-intl/server'
import { FormAlert } from '@/components/ui/field'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
  /** Trang đăng nhập: `?confirmed=1` (email đã xác nhận ở trình duyệt khác → đăng nhập bằng tay) */
  confirmed?: boolean
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * Thông báo mang theo từ URL ở trang đăng nhập / quên mật khẩu (từ /api/auth/confirm): link hết hạn, không tới được
 * máy chủ lúc xác nhận, email đã xác nhận. Nằm trong <Suspense fallback={null}> riêng phía trên form, không bọc form:
 * form không bao giờ bị thay khi phần đọc searchParams stream tới (chữ đã gõ không mất).
 */
export async function UrlNotices({ searchParams, confirmed = false }: Props) {
  const [query, t, tErrors] = await Promise.all([searchParams, getTranslations('auth'), getTranslations('errors')])
  const error = first(query.error)
  const message =
    error === 'LINK_EXPIRED' ? tErrors('LINK_EXPIRED') : error === 'NETWORK_ERROR' ? t('confirm.networkError') : null

  return (
    <>
      {confirmed && first(query.confirmed) === '1' && (
        <p role="status" className="mb-5 rounded-md border border-success/40 bg-success/10 px-3 py-2.5 text-sm text-success">
          {t('login.emailConfirmed')}
        </p>
      )}
      {message && (
        <div className="mb-5" data-testid="url-notice">
          <FormAlert>{message}</FormAlert>
        </div>
      )}
    </>
  )
}
