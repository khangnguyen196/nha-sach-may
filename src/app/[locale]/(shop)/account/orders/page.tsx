import { BookIcon, PackageIcon } from 'lucide-react'
import Image from 'next/image'
import type { Locale } from 'next-intl'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { buttonVariants } from '@/components/ui/button'
import { accountPageMetadata } from '@/features/account/metadata'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import { EmptyState } from '@/features/books/components/empty-state'
import { Pagination } from '@/features/books/components/pagination'
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge'
import { UsedItemLabel } from '@/features/orders/components/used-item-label'
import {
  ORDER_FILTERS,
  ORDERS_PAGE_SIZE,
  orderListQuery,
  parseOrderListParams,
  type OrderListParams,
} from '@/features/orders/params'
import { listOrders, type OrderListItem } from '@/features/orders/queries'
import { Link } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'
import { cn } from '@/lib/utils'

type Props = PageProps<'/[locale]/account/orders'>

const COVERS_SHOWN = 3

export async function generateMetadata() {
  const t = await getTranslations('orders')
  return accountPageMetadata(t('title'), '/account/orders')
}

export default async function OrdersPage({ searchParams }: Props) {
  const [t, tAccount, locale] = await Promise.all([getTranslations('orders'), getTranslations('account'), getLocale()])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:py-12">
      <Breadcrumb items={[{ label: tAccount('title'), href: '/account' }, { label: t('title') }]} />
      <h1 className="mt-6 font-serif text-3xl font-medium md:text-4xl">{t('title')}</h1>
      {/* Bộ lọc + danh sách đọc phiên và searchParams → stream sau; tiêu đề prerender sẵn */}
      <Suspense fallback={<OrdersSkeleton />}>
        <Orders locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Orders({ locale, searchParams }: { locale: Locale; searchParams: Props['searchParams'] }) {
  const params = parseOrderListParams(await searchParams)
  const user = await requireUser(locale, { pathname: '/account/orders', query: orderListQuery(params) })
  const [{ orders, total }, t, tNotFound] = await Promise.all([
    listOrders(params, user.id),
    getTranslations('orders'),
    getTranslations('notFound'),
  ])
  const totalPages = Math.ceil(total / ORDERS_PAGE_SIZE)
  // Trang vượt quá số đơn (URL sửa tay / đơn vừa bị xóa) → soft 404 như catalog (đã quyết: trang riêng tư, không index,
  // không thêm query ở proxy); link về trang đầu giữ bộ lọc trạng thái
  if (params.page > 1 && params.page > totalPages) {
    const firstPage = { pathname: '/account/orders', query: orderListQuery({ status: params.status, page: 1 }) } as const
    return <InlineNotFound kind="page" primary={{ href: firstPage, label: tNotFound('firstPage') }} />
  }

  return (
    <>
      <StatusFilters current={params.status} />
      {orders.length === 0 ? (
        <div className="mt-6">
          {params.status ? (
            <EmptyState
              icon={PackageIcon}
              title={t('emptyFilteredTitle')}
              description={t('emptyFiltered')}
              action={
                <Link href="/account/orders" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-10 px-4' })}>
                  {t('showAll')}
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={PackageIcon}
              title={t('emptyTitle')}
              description={t('empty')}
              action={
                <Link href="/" className={buttonVariants({ size: 'lg', className: 'h-10 px-4' })}>
                  {t('browse')}
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <ul className="mt-6 grid gap-3" data-testid="order-list">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </ul>
      )}
      <Pagination
        page={params.page}
        totalPages={totalPages}
        hrefFor={(page) => ({ pathname: '/account/orders', query: orderListQuery({ ...params, page }) })}
      />
    </>
  )
}

/** Link thật (không JS); trạng thái đang chọn có aria-current */
async function StatusFilters({ current }: { current: OrderListParams['status'] }) {
  const t = await getTranslations('orders')
  const filters = [undefined, ...ORDER_FILTERS]

  return (
    <nav aria-label={t('filtersLabel')} className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2">
        {filters.map((status) => {
          const active = status === current
          return (
            <li key={status ?? 'all'}>
              <Link
                href={{ pathname: '/account/orders', query: orderListQuery({ status, page: 1 }) }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-9 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-focus-ring',
                  active
                    ? 'border-primary bg-primary/15 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
                )}
              >
                {t(`filters.${status ?? 'all'}`)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Cả dòng là một link tới chi tiết. Bìa nhỏ alt="" vì tên sách đầu tiên hiện ngay bên cạnh. */
async function OrderRow({ order }: { order: OrderListItem }) {
  const [t, format] = await Promise.all([getTranslations('orders'), getFormatter()])
  const [first, ...rest] = order.order_items

  return (
    <li data-testid="order-row">
      <Link
        href={{ pathname: '/account/orders/[code]', params: { code: order.order_code } }}
        className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 rounded-lg border bg-surface p-4 transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-focus-ring sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-5"
      >
        {/* Khối bìa rộng cố định (3 bìa chồng nhau) để cột chữ thẳng hàng giữa các dòng. Mobile: tổng tiền xuống dưới
            thông tin; từ sm: cột phải */}
        <div className="row-span-2 flex w-24 -space-x-3 self-start sm:row-span-1 sm:self-center">
          {order.order_items.slice(0, COVERS_SHOWN).map((item) => (
            <div
              key={item.id}
              className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-cover border border-surface bg-surface-raised"
            >
              {item.cover_url ? (
                <Image src={item.cover_url} alt="" fill sizes="40px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-subtle">
                  <BookIcon aria-hidden className="size-4" />
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-sm font-semibold tracking-wide" data-testid="order-row-code">
              {order.order_code}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>
          {first && (
            <p className="mt-1 line-clamp-1 text-sm">
              {first.title}
              {rest.length > 0 && <span className="text-muted-foreground"> {t('moreBooks', { count: rest.length })}</span>}
            </p>
          )}
          {/* Đơn sách cũ luôn một dòng (place_used_order) → nhãn của dòng đầu */}
          {first && <UsedItemLabel item={first} className="mt-0.5 block text-sm text-muted-foreground" />}
          <p className="mt-0.5 text-sm text-muted-foreground">{format.dateTime(new Date(order.created_at), 'short')}</p>
        </div>
        <p className="col-start-2 font-semibold text-primary tabular-nums sm:col-start-3 sm:row-start-1" data-testid="order-row-total">
          {format.number(order.total, 'price')}
        </p>
      </Link>
    </li>
  )
}

function OrdersSkeleton() {
  return (
    <div aria-hidden className="animate-pulse motion-reduce:animate-none">
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-9 w-24 rounded-full bg-surface-raised" />
        ))}
      </div>
      <div className="mt-6 grid gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-[138px] rounded-lg bg-surface-raised sm:h-[116px]" />
        ))}
      </div>
    </div>
  )
}
