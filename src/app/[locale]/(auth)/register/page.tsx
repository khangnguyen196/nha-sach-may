import { getLocale, getTranslations } from 'next-intl/server'
import { signUp } from '@/features/auth/actions'
import { AuthPage, authLinkClass } from '@/features/auth/components/auth-page'
import { RegisterForm } from '@/features/auth/components/register-form'
import { authPageMetadata } from '@/features/auth/metadata'
import { Link } from '@/i18n/navigation'
import { getFormMessages } from '@/lib/form-messages'

export function generateMetadata() {
  return authPageMetadata('register')
}

export default async function RegisterPage() {
  const [t, locale, messages] = await Promise.all([
    getTranslations('auth'),
    getLocale(),
    getFormMessages(['WEAK_PASSWORD', 'SIGNUP_DISABLED']),
  ])

  return (
    <AuthPage
      title={t('register.title')}
      description={t('register.description')}
      footer={
        <>
          {t('register.hasAccount')}{' '}
          <Link href="/login" className={authLinkClass}>
            {t('register.loginLink')}
          </Link>
        </>
      }
    >
      <RegisterForm
        action={signUp.bind(null, locale)}
        messages={messages}
        labels={{
          fullName: t('fullName'),
          email: t('email'),
          password: t('password'),
          passwordHint: t('passwordHint'),
          submit: t('register.submit'),
          pending: t('pending'),
          checkInboxTitle: t('register.checkInboxTitle'),
          noScript: t('noScriptSubmit'),
          checkInbox: t.rich('register.checkInbox', {
            login: (chunks) => (
              <Link href="/login" className={authLinkClass}>
                {chunks}
              </Link>
            ),
            forgot: (chunks) => (
              <Link href="/forgot-password" className={authLinkClass}>
                {chunks}
              </Link>
            ),
          }),
        }}
      />
    </AuthPage>
  )
}
