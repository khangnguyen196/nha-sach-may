import 'server-only'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import type { ErrorCode } from '@/lib/errors'
import { getFormMessages } from '@/lib/form-messages'
import { placeholder } from '@/lib/template'
import { Constants } from '@/types/database'

/** Mã lỗi form đăng / sửa tin có thể gặp (action, tải ảnh, tính phí); câu không có tham số ICU */
const LISTING_FORM_CODES: ErrorCode[] = [
  'AUTH_REQUIRED',
  'LISTING_PENDING_LIMIT',
  'LISTING_PRICE_INVALID',
  'LISTING_PHOTOS_INVALID',
  'LISTING_PHOTO_LIMIT',
  'LISTING_NOT_EDITABLE',
]

/**
 * Chuỗi đã dịch cho ListingForm (client leaf không dùng useTranslations). Chuỗi có giá trị chỉ biết ở client (giá trần,
 * số tiền nhận, số ký tự…) giữ chỗ trống, client điền bằng fillTemplate. `signInNext`: URL hiển thị của trang.
 */
export async function getListingFormProps(locale: Locale, signInNext: string) {
  const [t, messages] = await Promise.all([
    getTranslations('used'),
    getFormMessages(LISTING_FORM_CODES, { signInNext }),
  ])
  return {
    locale,
    messages,
    conditions: Constants.public.Enums.used_condition.map((value) => ({
      value,
      label: t(`condition.${value}`),
      hint: t(`conditionHint.${value}`),
    })),
    labels: {
      book: t('form.book'),
      bookSearch: t('form.bookSearch'),
      bookSearchPlaceholder: t('form.bookSearchPlaceholder'),
      bookSearchHint: t('form.bookSearchHint'),
      searching: t('form.searching'),
      noResults: t('form.noResults'),
      resultsCount: t('form.resultsCount', { count: placeholder('count') }),
      searchError: t('form.searchError'),
      chooseBook: t('form.chooseBook'),
      chooseBookLabel: t('form.chooseBookLabel', { title: placeholder('title') }),
      changeBook: t('form.changeBook'),
      originalPrice: t('form.originalPrice', { price: placeholder('price') }),
      condition: t('form.condition'),
      price: t('form.price'),
      priceHint: t('form.priceHint', { max: placeholder('max') }),
      priceHintNoBook: t('form.priceHintNoBook'),
      payout: t('form.payout', { payout: placeholder('payout'), fee: placeholder('fee') }),
      quoting: t('form.quoting'),
      quoteError: t('form.quoteError'),
      description: t('form.description'),
      descriptionHint: t('form.descriptionHint'),
      counter: t('form.counter', { count: placeholder('count') }),
      photos: t('form.photos'),
      photosHint: t('form.photosHint'),
      addPhoto: t('form.addPhoto'),
      uploading: t('form.uploading'),
      photoUnreadable: t('form.photoUnreadable'),
      photoAlt: t('form.photoAlt', { number: placeholder('number') }),
      photoMissing: t('form.photoMissing'),
      removePhoto: t('form.removePhoto', { number: placeholder('number') }),
      submitCreate: t('form.submitCreate'),
      submitEdit: t('form.submitEdit'),
      pending: t('form.pending'),
      cancel: t('form.cancel'),
    },
  }
}

export type ListingFormProps = Awaited<ReturnType<typeof getListingFormProps>>
