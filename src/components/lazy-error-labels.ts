import 'server-only'
import { getTranslations } from 'next-intl/server'
import type { LazyErrorLabels } from './lazy-boundary'

/** Chuỗi của LazyBoundary, dịch ở server rồi truyền xuống client leaf qua props */
export async function getLazyErrorLabels(): Promise<LazyErrorLabels> {
  const [tErrors, tCommon] = await Promise.all([getTranslations('errors'), getTranslations('common')])
  return { message: tErrors('CHUNK_LOAD_FAILED'), reload: tCommon('reloadPage'), close: tCommon('close') }
}
