import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { updatePassword } from '@/features/auth/actions'
import { AuthPage } from '@/features/auth/components/auth-page'
import { Notice } from '@/features/auth/components/notice'
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form'
import { authPageMetadata } from '@/features/auth/metadata'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getFormMessages } from '@/lib/form-messages'

export function generateMetadata() {
  return authPageMetadata('reset')
}

export default async function ResetPasswordPage() {
  const t = await getTranslations('auth')
  return (
    <AuthPage title={t('reset.title')}>
      <Suspense fallback={<div className="h-48" />}>
        <ResetPasswordContent />
      </Suspense>
    </AuthPage>
  )
}

// Cần phiên recovery do /api/auth/confirm tạo từ link trong email
async function ResetPasswordContent() {
  const [t, user, messages] = await Promise.all([
    getTranslations('auth'),
    getCurrentUser(),
    getFormMessages(['WEAK_PASSWORD', 'SAME_PASSWORD', 'LINK_EXPIRED', 'RATE_LIMITED']),
  ])

  if (!user) {
    return (
      <Notice
        title={t('reset.noSessionTitle')}
        action={
          <Link href="/forgot-password" className={buttonVariants({ size: 'lg', className: 'h-11 px-5' })}>
            {t('reset.requestNew')}
          </Link>
        }
      >
        <p>{t('reset.noSession')}</p>
      </Notice>
    )
  }

  return (
    <>
      <p className="-mt-6 mb-8 text-sm text-muted-foreground">{t('reset.description', { email: user.email })}</p>
      <ResetPasswordForm
        action={updatePassword}
        messages={messages}
        labels={{
          newPassword: t('newPassword'),
          passwordHint: t('passwordHint'),
          submit: t('reset.submit'),
          pending: t('pending'),
          successTitle: t('reset.successTitle'),
          success: t('reset.success'),
          goToAccount: t('reset.goToAccount'),
        }}
      />
    </>
  )
}
