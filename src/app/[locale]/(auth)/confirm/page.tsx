import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { AuthPage } from '@/features/auth/components/auth-page'
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
 * bấm nút → form POST (không cần JS) về /api/auth/confirm mới gọi verifyOtp. Trình quét link chỉ mở GET nên không
 * dùng mất token.
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
  const [query, t] = await Promise.all([searchParams, getTranslations('auth.confirm')])
  const type = toOtpType(first(query.type))
  const tokenHash = toTokenHash(first(query.token_hash))

  if (!type || !tokenHash) {
    return (
      <Notice
        title={t('invalidTitle')}
        action={
          <Link href="/login" className={buttonVariants({ size: 'lg', className: 'h-11 px-5' })}>
            {t('backToLogin')}
          </Link>
        }
      >
        <p>{t('invalid')}</p>
      </Notice>
    )
  }

  const recovery = type === 'recovery'
  // next chỉ giữ đường dẫn nội bộ (route POST lọc lại lần nữa)
  const next = safeNextPath(first(query.next), '')
  return (
    <form method="post" action="/api/auth/confirm" className="rounded-lg border bg-surface p-6">
      <h2 className="font-serif text-xl font-medium">{recovery ? t('recoveryTitle') : t('emailTitle')}</h2>
      <p className="mt-3 text-sm text-muted-foreground">{recovery ? t('recoveryLead') : t('emailLead')}</p>
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
