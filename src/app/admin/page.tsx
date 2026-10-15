import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminLink, type AdminHref } from '@/components/admin/admin-link'
import { AdminPage } from '@/components/admin/admin-page'
import { getDashboardCounts } from '@/features/admin/dashboard/queries'

export async function generateMetadata() {
  const t = await getTranslations('admin.dashboard')
  return { title: t('title') }
}

export default async function AdminDashboardPage() {
  const t = await getTranslations('admin.dashboard')
  return (
    <AdminPage title={t('title')}>
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>
    </AdminPage>
  )
}

const grid = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'

async function Stats() {
  const [t, counts] = await Promise.all([getTranslations('admin.dashboard'), getDashboardCounts()])
  const stats: { label: string; value: number; href?: AdminHref }[] = [
    { label: t('pendingOrders'), value: counts.pendingOrders },
    { label: t('lowStock'), value: counts.lowStock, href: '/admin/sach?status=active&stock=low' },
    { label: t('outOfStock'), value: counts.outOfStock, href: '/admin/sach?status=active&stock=out' },
    { label: t('hiddenBooks'), value: counts.hiddenBooks, href: '/admin/sach?status=hidden' },
  ]
  return (
    <ul className={grid}>
      {stats.map((stat) => (
        <li key={stat.label} className="flex flex-col rounded-lg border bg-surface p-5">
          <span className="text-sm text-muted-foreground">{stat.label}</span>
          <span className="mt-2 text-3xl font-semibold tabular-nums">{stat.value}</span>
          {stat.href && (
            <AdminLink
              href={stat.href}
              className="mt-3 self-start rounded-sm text-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t('view')}
              <span className="sr-only">: {stat.label}</span>
            </AdminLink>
          )}
        </li>
      ))}
    </ul>
  )
}

function StatsSkeleton() {
  return (
    <ul className={grid} aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="h-[8.5rem] animate-pulse rounded-lg border bg-surface motion-reduce:animate-none" />
      ))}
    </ul>
  )
}
