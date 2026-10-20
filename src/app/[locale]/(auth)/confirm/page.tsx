import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { FormAlert } from '@/components/ui/field'
import { AuthPage } from '@/features/auth/components/auth-page'
import { LinkErrorNotice } from '@/features/auth/components/link-error-notice'
import { Notice } from '@/features/auth/components/notice'
import { authPageMetadata } from '@/features/auth/metadata'
import { safeNextPath } from '@/features/auth/next-path'
import { toOtpType, toTokenHash } from '@/features/auth/otp'
import { Link } from '@/i18n/navigation'

type Props = PageProps<'/[locale]/confirm'>

export function generateMetadata() {
  return authPageMetadata('confirm')
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * Trang trung gian của link trong email auth: GET /api/auth/confirm chuyển tới đây (không tiêu thụ token), người dùng
 * bấm nút → form POST về /api/auth/confirm mới gọi verifyOtp. Trình quét link chỉ mở GET nên không dùng mất token.
 * Form nằm trong Suspense (đọc `token_hash` từ searchParams) nên tắt JS thì không hiện; dải noscript ở layout giải
 * thích (docs/plans/no-js.md).
 */
export default async function ConfirmPage({ searchParams }: Props) {
  const [t, locale] = await Promise.all([getTranslations('auth.confirm'), getLocale()])
  return (
    <AuthPage title={t('title')}>
      <Suspense fallback={<div className="h-48" />}>
        <ConfirmContent locale={locale} searchParams={searchParams} />
      </Suspense>
    </AuthPage>
  )
}

async function ConfirmContent({ locale, searchParams }: { locale: Locale; searchParams: Props['searchParams'] }) {
  const [query, t, tErrors] = await Promise.all([searchParams, getTranslations('auth.confirm'), getTranslations('errors')])
  const type = toOtpType(first(query.type))
  const tokenHash = toTokenHash(first(query.token_hash))

  if (!type || !tokenHash) {
    const button = buttonVariants({ size: 'lg', className: 'h-11 px-5' })
    // Template mặc định: link lỗi về đây không có token_hash, lỗi nằm sau dấu # (chỉ client đọc được). Yêu cầu lại:
    // đặt lại mật khẩu → quên mật khẩu; xác nhận đăng ký → đăng ký lại cùng email (Supabase gửi lại thư xác nhận).
    return (
      <LinkErrorNotice
        invalid={
          <Notice
            title={t('invalidTitle')}
            action={
              <Link href="/login" className={button}>
                {t('backToLogin')}
              </Link>
            }
          >
            <p>{t('invalid')}</p>
          </Notice>
        }
        expired={
          <Notice
            title={t('expiredTitle')}
            action={
              <Link href={type === 'recovery' ? '/forgot-password' : '/register'} className={button} data-testid="request-new-link">
                {t('requestNew')}
              </Link>
            }
          >
            <p>{tErrors('LINK_EXPIRED')}</p>
          </Notice>
        }
      />
    )
  }

  const recovery = type === 'recovery'
  // next chỉ giữ đường dẫn nội bộ (route POST lọc lại lần nữa)
  const next = safeNextPath(first(query.next), '')
  return (
    <form method="post" action="/api/auth/confirm" className="rounded-lg border bg-surface p-6">
      <h2 className="font-serif text-xl font-medium">{recovery ? t('recoveryTitle') : t('emailTitle')}</h2>
      <p className="mt-3 text-sm text-muted-foreground">{recovery ? t('recoveryLead') : t('emailLead')}</p>
      {/* Lần bấm trước không tới được Supabase (route POST quay về đây cùng token) */}
      {first(query.error) === 'NETWORK_ERROR' && (
        <div className="mt-4">
          <FormAlert>{t('networkError')}</FormAlert>
        </div>
      )}
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <Button type="submit" size="lg" className="mt-6 h-11 w-full text-base">
        {recovery ? t('recoverySubmit') : t('emailSubmit')}
      </Button>
      <p className="mt-4 text-xs text-subtle">{t('why')}</p>
    </form>
  )
}
