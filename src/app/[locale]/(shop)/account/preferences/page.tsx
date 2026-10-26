import { SlidersHorizontalIcon } from 'lucide-react'
import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { accountPageMetadata } from '@/features/account/metadata'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import { EmptyState } from '@/features/books/components/empty-state'
import { unblockItem } from '@/features/prefs/actions'
import { BLOCK_LIMIT } from '@/features/prefs/blocks'
import { PrefsButton } from '@/features/prefs/components/prefs-button'
import { getMyBlockList } from '@/features/prefs/queries'
import { getPathname, Link } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'
import { getFormMessages } from '@/lib/form-messages'

export async function generateMetadata() {
  const t = await getTranslations('prefs.page')
  return accountPageMetadata(t('title'), '/account/preferences')
}

/** Nhóm theo thứ tự hiện trên trang */
const GROUPS = ['category', 'author', 'publisher', 'warning'] as const
const TITLE_ID = 'prefs-title'

export default async function PreferencesPage() {
  const [t, tAccount, locale] = await Promise.all([getTranslations('prefs.page'), getTranslations('account'), getLocale()])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">
      <Breadcrumb items={[{ label: tAccount('title'), href: '/account' }, { label: t('title') }]} />
      {/* tabIndex -1: nhận focus sau khi bỏ chặn mục cuối của một nhóm (nhóm biến mất) */}
      <h1 id={TITLE_ID} tabIndex={-1} className="mt-6 font-serif text-3xl font-medium outline-none md:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-3 max-w-reading text-sm text-muted-foreground">{t('intro')}</p>
      <Suspense fallback={<PreferencesSkeleton />}>
        <PreferencesList locale={locale} />
      </Suspense>
    </div>
  )
}

/** Theo phiên: danh sách chặn của chính người đang đăng nhập (RLS + lọc user_id), bỏ chặn từng mục */
async function PreferencesList({ locale }: { locale: Locale }) {
  const user = await requireUser(locale, '/account/preferences')
  const [t, tPrefs, list, messages] = await Promise.all([
    getTranslations('prefs.page'),
    getTranslations('prefs'),
    getMyBlockList(user.id, locale),
    getFormMessages([], { signInNext: getPathname({ href: '/account/preferences', locale }) }),
  ])

  if (list.total === 0) {
    return (
      <div className="mt-8" data-testid="prefs-empty">
        <EmptyState
          icon={SlidersHorizontalIcon}
          title={t('emptyTitle')}
          description={t('empty')}
          action={
            <Link href="/books" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-10 px-4' })}>
              {t('browse')}
            </Link>
          }
        />
      </div>
    )
  }

  const shared = { messages, pendingLabel: tPrefs('pending'), prefsLink: tPrefs('openPage') }
  return (
    <>
      <p className="mt-6 text-sm font-medium tabular-nums" data-testid="prefs-count">
        {t('count', { count: list.total, max: BLOCK_LIMIT })}
      </p>
      {GROUPS.map((group) => {
        const items = list[group]
        if (items.length === 0) return null
        const headingId = `prefs-${group}`
        return (
          <section key={group} aria-labelledby={headingId} className="mt-8" data-testid={headingId}>
            {/* tabIndex -1: đích focus sau khi bỏ chặn một mục của nhóm (giữ vị trí cuộn gần dòng vừa bỏ) */}
            <h2 id={headingId} tabIndex={-1} className="text-lg font-semibold outline-none">
              {t(`groups.${group}`)}
            </h2>
            <ul className="mt-3 divide-y rounded-lg border bg-surface">
              {items.map((item) => {
                const name = item.name ?? tPrefs('unknownTarget')
                return (
                  <li
                    key={item.rowId}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm"
                  >
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="min-w-0 rounded-sm font-medium break-words outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="min-w-0 font-medium break-words">{name}</span>
                    )}
                    <PrefsButton
                      {...shared}
                      action={unblockItem.bind(null, locale, { id: item.rowId })}
                      label={tPrefs('unblock')}
                      accessibleLabel={tPrefs('unblockLabel', { kind: tPrefs(`kinds.${group}`), name })}
                      focusAfterIds={[headingId, TITLE_ID]}
                      variant="outline"
                      size="sm"
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}

function PreferencesSkeleton() {
  return (
    <div aria-hidden className="mt-6 animate-pulse motion-reduce:animate-none">
      <div className="h-5 w-40 rounded-sm bg-surface-raised" />
      <div className="mt-8 h-6 w-32 rounded-sm bg-surface-raised" />
      <div className="mt-3 h-[120px] rounded-lg bg-surface-raised" />
    </div>
  )
}
