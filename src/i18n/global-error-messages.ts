import type { Locale } from 'next-intl'
import type { ErrorPageMessages } from '@/components/layout/error-view'

/**
 * Chuỗi cho app/global-error.tsx. Lỗi ở root layout thì không còn layout nào dịch hộ, và global-error nằm trong
 * bundle đầu của mọi trang nên không import messages/*.json (~30KB). Bản sao của namespace `errorPage`:
 * messages.test.ts kiểm tra hai bên khớp nhau; sửa chuỗi ở messages/*.json rồi chép sang đây.
 * Không import routing / next-intl ở đây (xem components/layout/error-view.tsx): đường dẫn trang chủ cũng chép sẵn,
 * messages.test.ts kiểm tra khớp localizedPath.
 */
export const GLOBAL_ERROR_MESSAGES: Record<Locale, ErrorPageMessages & { homeHref: string }> = {
  vi: {
    title: 'Có lỗi phía Nhà Sách Mây',
    description:
      'Có lỗi phía Nhà Sách Mây, không phải do bạn. Bạn bấm “Thử lại” nhé; nếu vẫn lỗi, gửi mã tra cứu bên dưới tới {email} để nhóm kiểm tra.',
    descriptionNoRef:
      'Có lỗi phía Nhà Sách Mây, không phải do bạn. Bạn bấm “Thử lại” nhé; nếu vẫn lỗi, gửi email tới {email} kèm đường dẫn trang này.',
    reference: 'Mã tra cứu: {digest}',
    retry: 'Thử lại',
    backHome: 'Về trang chủ',
    homeHref: '/',
  },
  en: {
    title: 'Something went wrong on our side',
    description:
      'This is a problem at Nhà Sách Mây, not something you did. Please press “Try again”; if it keeps happening, send the reference code below to {email}.',
    descriptionNoRef:
      'This is a problem at Nhà Sách Mây, not something you did. Please press “Try again”; if it keeps happening, email {email} with the link to this page.',
    reference: 'Reference code: {digest}',
    retry: 'Try again',
    backHome: 'Back to home',
    homeHref: '/en',
  },
}

export function isGlobalErrorLocale(value: unknown): value is Locale {
  return typeof value === 'string' && Object.hasOwn(GLOBAL_ERROR_MESSAGES, value)
}
