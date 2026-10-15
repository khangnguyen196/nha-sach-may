import { ChevronRightIcon, LayoutDashboardIcon, MapPinIcon, PackageIcon, type LucideIcon } from 'lucide-react'
import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminLink } from '@/components/admin/admin-link'
import { SubmitButton } from '@/components/ui/submit-button'
import { updateEmailLocale } from '@/features/account/actions'
import { EmailLocaleForm } from '@/features/account/components/email-locale-form'
import { accountPageMetadata } from '@/features/account/metadata'
import { getProfile } from '@/features/account/queries'
import { isAdmin } from '@/features/admin/auth'
import { signOut } from '@/features/auth/actions'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth'
import { getFormMessages } from '@/lib/form-messages'

export async function generateMetadata() {
  const t = await getTranslations('account')
  return accountPageMetadata(t('title'), '/account')
}

export default async function AccountPage() {
  const [t, locale] = await Promise.all([getTranslations('account'), getLocale()])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="font-serif text-3xl font-medium md:text-4xl">{t('title')}</h1>
      <Suspense fallback={<AccountSkeleton />}>
        <AccountContent locale={locale} />
      </Suspense>
    </div>
  )
}

async function AccountContent({ locale }: { locale: Locale }) {
  const user = await requireUser(locale, '/account')
  const [t, tAuth, profile, messages, admin] = await Promise.all([
    getTranslations('account'),
    getTranslations('auth'),
    getProfile(user.id),
    getFormMessages(['AUTH_REQUIRED']),
    isAdmin(),
  ])
  const name = profile?.full_name?.trim() || user.fullName || user.email

  return (
    <>
      <p className="mt-2 text-muted-foreground">{t('greeting', { name })}</p>
      <dl className="mt-8 rounded-lg border bg-surface p-5 text-sm">
        <dt className="text-muted-foreground">{t('email')}</dt>
        <dd className="mt-1 font-medium break-all">{user.email}</dd>
      </dl>

      <AccountCard href="/account/orders" icon={PackageIcon} title={t('orders')} description={t('ordersDescription')} />
      <AccountCard
        href="/account/addresses"
        icon={MapPinIcon}
        title={t('addresses')}
        description={t('addressesDescription')}
      />
      {admin && (
        // Khu quản trị không có [locale] → AdminLink (sang root layout khác: Next tải lại cả trang). Chỉ render khi
        // server xác nhận role admin; không prefetch trang admin mỗi lần mở trang tài khoản.
        <AdminLink href="/admin" prefetch={false} className={cardClass}>
          <CardContent icon={LayoutDashboardIcon} title={t('admin')} description={t('adminDescription')} />
        </AdminLink>
      )}

      <section className="mt-4 rounded-lg border bg-surface p-5">
        <EmailLocaleForm
          action={updateEmailLocale}
          messages={messages}
          defaultValue={profile?.locale ?? locale}
          options={routing.locales.map((value) => ({ value, label: t(`emailLocaleOptions.${value}`) }))}
          labels={{
            label: t('emailLocale'),
            description: t('emailLocaleDescription'),
            save: t('save'),
            saved: t('saved'),
            pending: tAuth('pending'),
          }}
        />
      </section>

      {/* Form + Server Action: đăng xuất chạy được cả khi không có JS */}
      <form action={signOut.bind(null, locale)} className="mt-10">
        <SubmitButton variant="outline" size="lg" className="h-11 px-5" pendingLabel={tAuth('pending')}>
          {t('signOut')}
        </SubmitButton>
      </form>
    </>
  )
}

type AccountCardProps = {
  href: '/account/orders' | '/account/addresses'
  icon: LucideIcon
  title: string
  description: string
}

const cardClass =
  'group mt-4 flex items-center gap-4 rounded-lg border bg-surface p-5 transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/50'

function AccountCard({ href, ...content }: AccountCardProps) {
  return (
    <Link href={href} className={cardClass}>
      <CardContent {...content} />
    </Link>
  )
}

function CardContent({ icon: Icon, title, description }: Omit<AccountCardProps, 'href'>) {
  return (
    <>
      <Icon aria-hidden className="size-5 shrink-0 text-primary" />
      <span className="flex-1">
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
      <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
    </>
  )
}

function AccountSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="mt-3 h-5 w-48 rounded-sm bg-surface-raised" />
      <div className="mt-8 h-[78px] rounded-lg bg-surface-raised" />
      <div className="mt-4 h-[86px] rounded-lg bg-surface-raised" />
      <div className="mt-4 h-[86px] rounded-lg bg-surface-raised" />
      <div className="mt-4 h-[170px] rounded-lg bg-surface-raised" />
    </div>
  )
}
