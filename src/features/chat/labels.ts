import 'server-only'
import { getTranslations } from 'next-intl/server'
import { getCategories } from '@/features/books/queries'
import { placeholder } from '@/lib/template'
import { CHAT_INPUT } from './config'

/** Số danh mục gốc gợi ý khi Mây hết lượt / lỗi ("Xem theo thể loại") */
const BROWSE_CATEGORIES = 4

/**
 * Chuỗi của bong bóng + khung chat, dịch sẵn ở server (client leaf không kéo intl-messageformat). Chatbot chỉ có ở
 * trang tiếng Việt. Chỗ trống chỉ biết ở client ({time}, {count}, {title}) điền bằng fillTemplate.
 */
export async function getChatLabels() {
  const t = await getTranslations({ locale: 'vi', namespace: 'chat' })
  const time = placeholder('time')
  return {
    open: t('open'),
    title: t('title'),
    subtitle: t('subtitle'),
    close: t('close'),
    greeting: t('greeting'),
    greetingBook: t('greetingBook'),
    aboutBook: t('aboutBook', { title: placeholder('title') }),
    chips: [t('chips.mood'), t('chips.weekend'), t('chips.startup')],
    bookChips: [t('chips.what'), t('chips.who'), t('chips.similar')],
    gate: {
      title: t('gate.title'),
      items: [t('gate.ai'), t('gate.personal'), t('gate.freeTier'), t('gate.adult')],
      confirm: t('gate.confirm'),
    },
    disclaimer: t('disclaimer'),
    inputLabel: t('inputLabel'),
    placeholder: t('placeholder'),
    counter: t('counter', { count: placeholder('count'), max: CHAT_INPUT.maxChars }),
    send: t('send'),
    sending: t('sending'),
    you: t('you'),
    suggestions: t('suggestions'),
    languageNotice: t('languageNotice'),
    search: t('search'),
    browse: t('browse'),
    errors: {
      freeDay: { vi: t('freeDay', { time }), en: t('freeDayEn', { time }) },
      freeMinute: { vi: t('freeMinute'), en: t('freeMinuteEn') },
      visitorHour: t('visitorHour', { time }),
      visitorDay: t('visitorDay'),
      region: t('region'),
      tired: t('tired'),
    },
  }
}

export type ChatLabels = Awaited<ReturnType<typeof getChatLabels>>

/** Danh mục gốc đang hiện, theo sort_order (getCategories đã sắp) */
export async function getChatBrowseCategories() {
  const categories = await getCategories()
  return categories
    .filter((category) => category.parent_id === null)
    .slice(0, BROWSE_CATEGORIES)
    .map((category) => ({ slug: category.slug, name: category.name }))
}

export type ChatBrowseCategory = Awaited<ReturnType<typeof getChatBrowseCategories>>[number]
