import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ActionButtonForm } from '@/components/admin/action-button-form'
import { AdminBackLink, AdminPage } from '@/components/admin/admin-page'
import { FormSkeleton } from '@/components/admin/form-skeleton'
import { getAdminFormMessages } from '@/features/admin/form-messages'
import { rowIdSchema } from '@/features/admin/schemas'
import { deleteVoucher, updateVoucher } from '@/features/admin/vouchers/actions'
import { VoucherForm } from '@/features/admin/vouchers/components/voucher-form'
import { getVoucherFormProps, voucherFormValues } from '@/features/admin/vouchers/form-props'
import { getAdminVoucher } from '@/features/admin/vouchers/queries'

type Props = PageProps<'/admin/voucher/[id]'>

export async function generateMetadata() {
  const t = await getTranslations('admin.vouchers')
  return { title: t('editTitle') }
}

export default async function EditVoucherPage({ params }: Props) {
  const t = await getTranslations('admin.vouchers')
  return (
    <AdminPage title={t('editTitle')} before={<AdminBackLink href="/admin/voucher" label={t('title')} />}>
      <Suspense fallback={<FormSkeleton sections={2} />}>
        <EditVoucher params={params} />
      </Suspense>
    </AdminPage>
  )
}

const panel = 'grid gap-4 rounded-lg border bg-surface p-5'

async function EditVoucher({ params }: { params: Props['params'] }) {
  const { id: rawId } = await params
  const id = rowIdSchema.safeParse(rawId)
  if (!id.success) notFound()

  const [voucher, { messages, labels }, deleteMessages, t] = await Promise.all([
    getAdminVoucher(id.data),
    getVoucherFormProps('edit'),
    getAdminFormMessages(['VOUCHER_IN_USE']),
    getTranslations('admin.vouchers'),
  ])
  if (!voucher) notFound()
  const used = voucher.used_count > 0 || voucher.orderCount > 0

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
      <div className="grid min-w-0 gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="font-mono text-2xl font-semibold tracking-wide">{voucher.code}</h2>
          <p className="text-sm text-muted-foreground">{t('used', { count: voucher.used_count })}</p>
        </div>
        <VoucherForm
          action={updateVoucher.bind(null, voucher.id)}
          messages={messages}
          labels={labels}
          initial={voucherFormValues(voucher)}
        />
      </div>

      <aside>
        <section aria-labelledby="voucher-delete-title" className={panel}>
          <h2 id="voucher-delete-title" className="text-sm font-semibold">
            {t('delete.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{used ? t('delete.inUse') : t('delete.hint')}</p>
          <ActionButtonForm
            action={deleteVoucher.bind(null, voucher.id)}
            messages={deleteMessages}
            label={t('delete.submit')}
            pendingLabel={t('delete.pending')}
            variant="destructive"
          />
        </section>
      </aside>
    </div>
  )
}
