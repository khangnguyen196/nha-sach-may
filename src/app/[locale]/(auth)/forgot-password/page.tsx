import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requestPasswordReset } from '@/features/auth/actions'
import { AuthPage, authLinkClass } from '@/features/auth/components/auth-page'
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form'
import { UrlNotices } from '@/features/auth/components/url-notices'
import { authPageMetadata } from '@/features/auth/metadata'
import { Link } from '@/i18n/navigation'
import { getFormMessages } from '@/lib/form-messages'

type Props = PageProps<'/[locale]/forgot-password'>

export function generateMetadata() {
  return authPageMetadata('forgot')
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const [t, locale, messages] = await Promise.all([
    getTranslations('auth'),
    getLocale(),
    getFormMessages(['RATE_LIMITED', 'LINK_EXPIRED']),
  ])
  const labels = {
    email: t('email'),
    submit: t('forgot.submit'),
    pending: t('pending'),
    sentTitle: t('forgot.sentTitle'),
    sent: t('forgot.sent'),
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
      {/* ?error= từ /api/auth/confirm (link hết hạn, không tới được máy chủ): thông báo riêng phía trên, không bọc form */}
      <Suspense fallback={null}>
        <UrlNotices searchParams={searchParams} />
      </Suspense>
      {/* locale bind sẵn: link trong email (template mặc định) quay về trang đặt mật khẩu đúng ngôn ngữ */}
      <ForgotPasswordForm action={requestPasswordReset.bind(null, locale)} messages={messages} labels={labels} />
    </AuthPage>
  )
}
