import { LayoutDashboardIcon, UserIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminLink } from '@/components/admin/admin-link'
import { buttonVariants } from '@/components/ui/button'
import { initialOf } from '@/features/account/utils'
import { isAdmin } from '@/features/admin/auth'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import { cn } from '@/lib/utils'

const iconLink = buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'text-muted-foreground' })

/**
 * Icon tài khoản ở header. Phần đọc phiên (cookies) nằm trong Suspense → header vẫn prerender, 0 JS client.
 * Fallback = icon trỏ /tai-khoan (proxy tự chuyển sang đăng nhập nếu chưa có phiên).
 * Link /account KHÔNG prefetch, cả fallback lẫn khi đã đăng nhập: prefetch chạy lúc chưa có phiên (fallback), hoặc
 * Server Action đổi cookie (đăng xuất) → router bỏ cache và prefetch lại link đang hiện khi cookie đã bị xóa (giả thuyết,
 * e2e chập chờn "gộp giỏ khách khi đăng nhập, đăng xuất rồi đăng nhập lại") → proxy 307 sang /dang-nhap, Next 307 thêm
 * `_rsc` rồi trả 404 cho segment `account/__PAGE__` (trang đăng nhập không có) → lỗi 404 trong console
 * (docs/plans/sau-ux.md mục 4; kiểm tĩnh src/lib/no-prefetch-account.test.ts). Khu tài khoản là trang động nên prefetch lợi ít.
 */
export async function AccountLink() {
  const t = await getTranslations('layout')
  return (
    <Suspense fallback={<IconLink href="/account" label={t('account')} prefetch={false} />}>
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
      <Link href="/account" prefetch={false} className={iconLink}>
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

/**
 * Link sang khu quản trị (không có [locale], root layout khác: Next tải lại cả trang). Quyền kiểm ở server.
 * Dưới `sm` header không đủ chỗ cho nút thứ 6 (tràn ngang ở 360–390px) → điện thoại dùng link ở trang tài khoản.
 */
async function AdminIconLink() {
  if (!(await isAdmin())) return null
  const t = await getTranslations('layout')
  return (
    <AdminLink
      href="/admin"
      prefetch={false}
      className={cn(iconLink, 'hidden sm:inline-flex')}
      data-testid="header-admin-link"
    >
      <LayoutDashboardIcon aria-hidden />
      <span className="sr-only">{t('admin')}</span>
    </AdminLink>
  )
}

function IconLink({ href, label, prefetch }: { href: '/account' | '/login'; label: string; prefetch?: false }) {
  return (
    <Link href={href} prefetch={prefetch} className={iconLink}>
      <UserIcon aria-hidden />
      <span className="sr-only">{label}</span>
    </Link>
  )
}
