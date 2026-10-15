import 'server-only'
import { getTranslations } from 'next-intl/server'
import { getAdminFormMessages } from '../form-messages'
import type { AuthorFormLabels } from './components/author-form'

/** Chuỗi + mã lỗi cho form tác giả; `mode` đổi nhãn nút (tạo / lưu) */
export async function getAuthorFormProps(mode: 'create' | 'edit') {
  const [t, tCommon, messages] = await Promise.all([
    getTranslations('admin.authors.fields'),
    getTranslations('admin.common'),
    getAdminFormMessages(['SLUG_TAKEN']),
  ])
  const labels: AuthorFormLabels = {
    name: t('name'),
    slug: t('slug'),
    slugHint: mode === 'edit' ? `${tCommon('slugHint')} ${tCommon('slugChangeHint')}` : tCommon('slugHint'),
    bio: t('bio'),
    bioEn: t('bioEn'),
    bioEnHint: t('bioEnHint'),
    submit: mode === 'edit' ? tCommon('save') : tCommon('create'),
    pending: mode === 'edit' ? tCommon('saving') : tCommon('creating'),
    saved: tCommon('saved'),
    cancel: tCommon('cancel'),
  }
  return { messages, labels }
}
