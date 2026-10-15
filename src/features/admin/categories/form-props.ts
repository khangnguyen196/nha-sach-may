import 'server-only'
import { getTranslations } from 'next-intl/server'
import { getAdminFormMessages } from '../form-messages'
import type { CategoryFormLabels } from './components/category-form'

/** Chuỗi + mã lỗi cho form danh mục; `mode` đổi nhãn nút (tạo / lưu) */
export async function getCategoryFormProps(mode: 'create' | 'edit') {
  const [t, tCommon, messages] = await Promise.all([
    getTranslations('admin.categories.fields'),
    getTranslations('admin.common'),
    getAdminFormMessages(['SLUG_TAKEN', 'CATEGORY_HAS_BOOKS']),
  ])
  const labels: CategoryFormLabels = {
    name: t('name'),
    nameEn: t('nameEn'),
    nameEnHint: t('nameEnHint'),
    slug: t('slug'),
    slugHint: mode === 'edit' ? `${tCommon('slugHint')} ${tCommon('slugChangeHint')}` : tCommon('slugHint'),
    description: t('description'),
    descriptionEn: t('descriptionEn'),
    parent: t('parent'),
    noParent: t('noParent'),
    parentHint: t('parentHint'),
    sortOrder: t('sortOrder'),
    sortOrderHint: t('sortOrderHint'),
    active: t('active'),
    activeHint: t('activeHint'),
    hidden: tCommon('hidden'),
    submit: mode === 'edit' ? tCommon('save') : tCommon('create'),
    pending: mode === 'edit' ? tCommon('saving') : tCommon('creating'),
    saved: tCommon('saved'),
    cancel: tCommon('cancel'),
  }
  return { messages, labels }
}
