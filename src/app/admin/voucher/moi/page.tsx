import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AdminBackLink, AdminPage } from '@/components/admin/admin-page'
import { FormSkeleton } from '@/components/admin/form-skeleton'
import { createVoucher } from '@/features/admin/vouchers/actions'
import { VoucherForm } from '@/features/admin/vouchers/components/voucher-form'
import { EMPTY_VOUCHER, getVoucherFormProps } from '@/features/admin/vouchers/form-props'

export async function generateMetadata() {
  const t = await getTranslations('admin.vouchers')
  return { title: t('newTitle') }
}

export default async function NewVoucherPage() {
  const t = await getTranslations('admin.vouchers')
  return (
    <AdminPage title={t('newTitle')} before={<AdminBackLink href="/admin/voucher" label={t('title')} />}>
      <Suspense fallback={<FormSkeleton sections={2} />}>
        <NewVoucherForm />
      </Suspense>
    </AdminPage>
  )
}

async function NewVoucherForm() {
  const { messages, labels } = await getVoucherFormProps('create')
  return <VoucherForm action={createVoucher} messages={messages} labels={labels} initial={EMPTY_VOUCHER} />
}
