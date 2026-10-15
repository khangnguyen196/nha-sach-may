import { LayoutDashboardIcon, UserIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminLink } from '@/components/admin/admin-link'
import { buttonVariants } from '@/components/ui/button'
import { initialOf } from '@/features/account/utils'
import { isAdmin } from '@/features/admin/auth'
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
    <>
      {/* Kiểm tra quyền là một request nữa: boundary riêng để icon tài khoản không phải chờ; chỉ admin thấy icon này */}
      <Suspense fallback={null}>
        <AdminIconLink />
      </Suspense>
      <Link href="/account" className={iconLink}>
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-surface-raised text-sm font-semibold text-foreground"
        >
          {initialOf(name)}
        </span>
        <span className="sr-only">{tAccount('signedInAs', { name })}</span>
      </Link>
    </>
  )
}

/** Link sang khu quản trị (không có [locale], root layout khác: Next tải lại cả trang). Quyền kiểm ở server. */
async function AdminIconLink() {
  if (!(await isAdmin())) return null
  const t = await getTranslations('layout')
  return (
    <AdminLink href="/admin" prefetch={false} className={iconLink} data-testid="header-admin-link">
      <LayoutDashboardIcon aria-hidden />
      <span className="sr-only">{t('admin')}</span>
    </AdminLink>
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
