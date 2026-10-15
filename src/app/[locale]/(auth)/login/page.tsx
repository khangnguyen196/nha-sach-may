import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { signIn } from '@/features/auth/actions'
import { AuthPage, authLinkClass } from '@/features/auth/components/auth-page'
import { LoginForm } from '@/features/auth/components/login-form'
import { authPageMetadata } from '@/features/auth/metadata'
import { safeNextPath } from '@/features/auth/next-path'
import { Link } from '@/i18n/navigation'
import { getFormMessages, type FormMessages } from '@/lib/form-messages'

type Props = PageProps<'/[locale]/login'>

export function generateMetadata() {
  return authPageMetadata('login')
}

export default async function LoginPage({ searchParams }: Props) {
  const [t, locale, messages] = await Promise.all([
    getTranslations('auth'),
    getLocale(),
    getFormMessages(['INVALID_CREDENTIALS', 'EMAIL_NOT_CONFIRMED', 'RATE_LIMITED', 'LINK_EXPIRED']),
  ])
  const form = {
    locale,
    messages,
    labels: {
      email: t('email'),
      password: t('password'),
      submit: t('login.submit'),
      pending: t('pending'),
      forgot: t('login.forgot'),
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
      {/* ?next= và ?error= chỉ có lúc request → trong Suspense; fallback là cùng form, chưa có hai giá trị đó */}
      <Suspense fallback={<Form {...form} />}>
        <FormWithParams {...form} searchParams={searchParams} />
      </Suspense>
    </AuthPage>
  )
}

type FormProps = {
  locale: Locale
  messages: FormMessages
  labels: Parameters<typeof LoginForm>[0]['labels']
  next?: string
  initialError?: string
}

function Form({ locale, ...props }: FormProps) {
  return <LoginForm action={signIn.bind(null, locale)} {...props} />
}

async function FormWithParams({ searchParams, ...form }: FormProps & { searchParams: Props['searchParams'] }) {
  const { next, error } = await searchParams
  const safeNext = safeNextPath(Array.isArray(next) ? next[0] : next, '')
  return (
    <Form
      {...form}
      next={safeNext || undefined}
      initialError={error === 'LINK_EXPIRED' ? form.messages.errors.LINK_EXPIRED : undefined}
    />
  )
}
