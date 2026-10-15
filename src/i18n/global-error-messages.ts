import type { Locale } from 'next-intl'
import type { ErrorPageMessages } from '@/components/layout/error-view'

/**
 * Chuỗi cho app/global-error.tsx. Lỗi ở root layout thì không còn layout nào dịch hộ, và global-error nằm trong
 * bundle đầu của mọi trang nên không import messages/*.json (~30KB). Bản sao của namespace `errorPage`:
 * messages.test.ts kiểm tra hai bên khớp nhau; sửa chuỗi ở messages/*.json rồi chép sang đây.
 */
export const GLOBAL_ERROR_MESSAGES: Record<Locale, ErrorPageMessages> = {
  vi: {
    title: 'Không tải được trang',
    description: 'Đã có lỗi khi tải nội dung. Có thể kết nối đang chập chờn, bạn thử lại sau ít phút nhé.',
    retry: 'Thử lại',
    backHome: 'Về trang chủ',
  },
  en: {
    title: 'This page could not be loaded',
    description:
      'Something went wrong while loading this page. The connection may be unstable, so please try again in a moment.',
    retry: 'Try again',
    backHome: 'Back to home',
  },
}
