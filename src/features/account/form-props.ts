import 'server-only'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { getFormMessages } from '@/lib/form-messages'
import { getProvinceOptions } from './divisions'

/** Chuỗi + danh sách tỉnh cho AddressForm, dùng chung trang thêm và trang sửa */
/** `signInNext`: URL hiển thị của trang (link "Đăng nhập lại" khi phiên hết lúc đang nhập) */
export async function getAddressFormProps(locale: Locale, signInNext: string) {
  const [t, tAuth, messages] = await Promise.all([
    getTranslations('address'),
    getTranslations('auth'),
    getFormMessages(['AUTH_REQUIRED', 'INVALID_ADDRESS'], { signInNext }),
  ])
  return {
    locale,
    messages,
    provinces: getProvinceOptions(locale),
    labels: {
      recipientName: t('recipientName'),
      phone: t('phone'),
      province: t('province'),
      ward: t('ward'),
      street: t('street'),
      selectProvince: t('selectProvince'),
      selectWard: t('selectWard'),
      selectProvinceFirst: t('selectProvinceFirst'),
      loadingWards: t('loadingWards'),
      wardsError: t('wardsError'),
      save: t('save'),
      pending: tAuth('pending'),
      cancel: t('cancel'),
    },
  }
}
