import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { resendConfirmation, signIn } from '@/features/auth/actions'
import { AuthPage, authLinkClass } from '@/features/auth/components/auth-page'
import { LoginForm } from '@/features/auth/components/login-form'
import { UrlNotices } from '@/features/auth/components/url-notices'
import { authPageMetadata } from '@/features/auth/metadata'
import { Link } from '@/i18n/navigation'
import { getFormMessages } from '@/lib/form-messages'
import { placeholder } from '@/lib/template'

type Props = PageProps<'/[locale]/login'>

export function generateMetadata() {
  return authPageMetadata('login')
}

export default async function LoginPage({ searchParams }: Props) {
  const [t, locale, messages] = await Promise.all([
    getTranslations('auth'),
    getLocale(),
    getFormMessages([
      'INVALID_CREDENTIALS',
      'EMAIL_NOT_CONFIRMED',
      'RATE_LIMITED',
      'LINK_EXPIRED',
      'ACCOUNT_LOCKED',
      'SESSION_EXPIRED',
    ]),
  ])
  const form = {
    messages,
    labels: {
      email: t('email'),
      password: t('password'),
      submit: t('login.submit'),
      pending: t('pending'),
      forgot: t('login.forgot'),
    },
    resendLabels: {
      submit: t('resend.submit'),
      pending: t('resend.pending'),
      sent: t('resend.sent'),
      wait: t('resend.wait', { seconds: placeholder('seconds') }),
    },
  }

  return (
    <AuthPage
      title={t('login.title')}
      description={t('login.description')}
      footer={
        <>
          {t('login.noAccount')}{' '}
          <Link href="/register" className={authLinkClass}>
            {t('login.registerLink')}
          </Link>
        </>
      }
    >
      {/* Chỉ thông báo của URL đọc searchParams (stream sau); form nằm trong khung tĩnh, ?next= đọc ở client */}
      <Suspense fallback={null}>
        <UrlNotices searchParams={searchParams} confirmed />
      </Suspense>
      <LoginForm action={signIn.bind(null, locale)} resend={resendConfirmation.bind(null, locale)} {...form} />
    </AuthPage>
  )
}
