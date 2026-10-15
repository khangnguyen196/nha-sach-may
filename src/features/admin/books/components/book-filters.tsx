import { getTranslations } from 'next-intl/server'
import { AdminLink } from '@/components/admin/admin-link'
import { Button, buttonVariants } from '@/components/ui/button'
import { SelectField, TextField } from '@/components/ui/field'
import type { CategoryGroup } from '../../categories/tree'
import type { BookListParams } from '../params'

/**
 * Bộ lọc là form GET: chạy không cần JS, kết quả nằm trên URL (chia sẻ được, back / forward đúng). Gửi lại form
 * không kèm `page` → về trang 1.
 */
export async function BookFilters({ params, categoryGroups }: { params: BookListParams; categoryGroups: CategoryGroup[] }) {
  const [t, tCommon] = await Promise.all([getTranslations('admin.books.filters'), getTranslations('admin.common')])
  const hasFilters = Boolean(params.q || params.category || params.status || params.stock)

  return (
    <form
      method="get"
      action="/admin/sach"
      role="search"
      aria-label={t('label')}
      className="grid gap-4 rounded-lg border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end"
    >
      <TextField
        name="q"
        type="search"
        label={t('q')}
        placeholder={t('qHint')}
        defaultValue={params.q ?? ''}
        maxLength={100}
        idPrefix="filter"
      />
      <SelectField name="category" label={t('category')} defaultValue={params.category ?? ''} idPrefix="filter">
        <option value="">{t('allCategories')}</option>
        {categoryGroups.map((group) => {
          const options = group.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))
          return group.label ? (
            <optgroup key={group.label} label={group.label}>
              {options}
            </optgroup>
          ) : (
            options
          )
        })}
      </SelectField>
      <SelectField name="status" label={t('status')} defaultValue={params.status ?? ''} idPrefix="filter">
        <option value="">{t('allStatuses')}</option>
        <option value="active">{t('statusActive')}</option>
        <option value="hidden">{t('statusHidden')}</option>
      </SelectField>
      <SelectField name="stock" label={t('stock')} defaultValue={params.stock ?? ''} idPrefix="filter">
        <option value="">{t('allStock')}</option>
        <option value="low">{t('stockLow')}</option>
        <option value="out">{t('stockOut')}</option>
      </SelectField>
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-11 px-5">
          {tCommon('filter')}
        </Button>
        {hasFilters && (
          <AdminLink href="/admin/sach" className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'h-11 px-4' })}>
            {tCommon('clearFilters')}
          </AdminLink>
        )}
      </div>
    </form>
  )
}
