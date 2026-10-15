import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requestPasswordReset } from '@/features/auth/actions'
import { AuthPage, authLinkClass } from '@/features/auth/components/auth-page'
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form'
import { authPageMetadata } from '@/features/auth/metadata'
import { Link } from '@/i18n/navigation'
import { getFormMessages, type FormMessages } from '@/lib/form-messages'

type Props = PageProps<'/[locale]/forgot-password'>

export function generateMetadata() {
  return authPageMetadata('forgot')
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const [t, messages] = await Promise.all([getTranslations('auth'), getFormMessages(['RATE_LIMITED', 'LINK_EXPIRED'])])
  const form = {
    messages,
    labels: {
      email: t('email'),
      submit: t('forgot.submit'),
      pending: t('pending'),
      sentTitle: t('forgot.sentTitle'),
      sent: t('forgot.sent'),
    },
  }

  return (
    <AuthPage
      title={t('forgot.title')}
      description={t('forgot.description')}
      footer={
        <Link href="/login" className={authLinkClass}>
          {t('forgot.backToLogin')}
        </Link>
      }
    >
      {/* ?error=LINK_EXPIRED khi link đặt lại mật khẩu đã hết hạn (từ /api/auth/confirm) */}
      <Suspense fallback={<ForgotPasswordForm action={requestPasswordReset} {...form} />}>
        <FormWithError {...form} searchParams={searchParams} />
      </Suspense>
    </AuthPage>
  )
}

async function FormWithError({
  searchParams,
  messages,
  labels,
}: {
  searchParams: Props['searchParams']
  messages: FormMessages
  labels: Parameters<typeof ForgotPasswordForm>[0]['labels']
}) {
  const { error } = await searchParams
  return (
    <ForgotPasswordForm
      action={requestPasswordReset}
      messages={messages}
      labels={labels}
      initialError={error === 'LINK_EXPIRED' ? messages.errors.LINK_EXPIRED : undefined}
    />
  )
}
