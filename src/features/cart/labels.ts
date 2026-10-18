import 'server-only'
import { getLocale, getTranslations } from 'next-intl/server'
import { getPathname } from '@/i18n/navigation'
import { SUPPORT_EMAIL } from '@/lib/support'
import { placeholder } from '@/lib/template'
import type { CartViewLabels } from './components/cart-view'

/**
 * Chuỗi cho CartView; tham số chỉ biết ở client (tên sách giỏ khách, số tiền còn thiếu) để chỗ trống. Giỏ tài khoản có
 * link "Đăng nhập lại" về trang giỏ khi phiên hết giữa chừng.
 */
export async function getCartViewLabels(): Promise<CartViewLabels> {
  const [t, tErrors, tCommon, locale] = await Promise.all([
    getTranslations('cart'),
    getTranslations('errors'),
    getTranslations('common'),
    getLocale(),
  ])
  const title = placeholder('title')
  const stock = placeholder('stock')
  return {
    lines: t('lines'),
    unavailable: t('unavailable'),
    unavailableTitle: t('unavailableTitle'),
    unavailableHint: t('unavailableHint'),
    removeLabel: t('removeLabel', { title }),
    removeUnavailableLabel: t('removeUnavailableLabel'),
    decreaseLabel: t('decreaseLabel', { title }),
    increaseLabel: t('increaseLabel', { title }),
    quantityLabel: t('quantityLabel', { title }),
    unitPrice: t('unitPrice'),
    lineTotal: t('lineTotal'),
    overStock: t('overStock', { stock }),
    soldOut: t('soldOut'),
    reduceTo: t('reduceTo', { stock }),
    summary: t('summary'),
    itemCount: t('itemCount'),
    subtotal: t('subtotal'),
    shipping: t('shipping'),
    freeShipping: t('freeShipping'),
    total: t('total'),
    freeShipRemaining: t('freeShipRemaining', { amount: placeholder('amount') }),
    freeShipReached: t('freeShipReached'),
    freeShipProgress: t('freeShipProgress'),
    checkout: t('checkout'),
    updating: t('updating'),
    error: tErrors('UNKNOWN', { email: SUPPORT_EMAIL }),
    networkError: t('networkError'),
    signIn: { next: getPathname({ href: '/cart', locale }), label: tCommon('signInAgain') },
  }
}
