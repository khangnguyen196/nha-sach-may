import { UserIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { initialOf } from '@/features/account/utils'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'

const iconLink = buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'text-muted-foreground' })

/**
 * Icon tài khoản ở header. Phần đọc phiên (cookies) nằm trong Suspense → header vẫn prerender, 0 JS client.
 * Fallback = icon trỏ /tai-khoan (proxy tự chuyển sang đăng nhập nếu chưa có phiên).
 */
export async function AccountLink() {
  const t = await getTranslations('layout')
  return (
    <Suspense fallback={<IconLink href="/account" label={t('account')} />}>
      <AccountStatus />
    </Suspense>
  )
}

async function AccountStatus() {
  const [user, tAuth, tAccount] = await Promise.all([
    getCurrentUser(),
    getTranslations('auth'),
    getTranslations('account'),
  ])
  if (!user) return <IconLink href="/login" label={tAuth('login.title')} />

  const name = user.fullName ?? user.email
  return (
    <Link href="/account" className={iconLink}>
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-full bg-surface-raised text-sm font-semibold text-foreground"
      >
        {initialOf(name)}
      </span>
      <span className="sr-only">{tAccount('signedInAs', { name })}</span>
    </Link>
  )
}

function IconLink({ href, label }: { href: '/account' | '/login'; label: string }) {
  return (
    <Link href={href} className={iconLink}>
      <UserIcon aria-hidden />
      <span className="sr-only">{label}</span>
    </Link>
  )
}
