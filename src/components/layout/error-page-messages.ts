import 'server-only'
import { getTranslations } from 'next-intl/server'
import { placeholder } from '@/lib/template'
import type { ErrorPageMessages } from './error-view'

/** Chuỗi cho ErrorMessagesProvider (layout [locale] và admin): giữ chỗ trống {email}, {digest} để ErrorView điền */
export async function getErrorPageMessages(): Promise<ErrorPageMessages> {
  const t = await getTranslations('errorPage')
  const email = placeholder('email')
  return {
    title: t('title'),
    description: t('description', { email }),
    descriptionNoRef: t('descriptionNoRef', { email }),
    reference: t('reference', { digest: placeholder('digest') }),
    retry: t('retry'),
    backHome: t('backHome'),
  }
}
