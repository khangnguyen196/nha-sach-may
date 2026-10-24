import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
  // `/` luôn là tiếng Việt, không tự chuyển theo Accept-Language: dễ đoán, URL ổn định cho SEO
  localeDetection: false,
  localeCookie: false,
  // Khóa = đường dẫn trong thư mục app/[locale]; giá trị = URL hiển thị theo từng ngôn ngữ
  pathnames: {
    '/': '/',
    '/categories/[slug]': { vi: '/danh-muc/[slug]', en: '/categories/[slug]' },
    '/books': { vi: '/sach', en: '/books' },
    '/books/[slug]': { vi: '/sach/[slug]', en: '/books/[slug]' },
    '/authors/[slug]': { vi: '/tac-gia/[slug]', en: '/authors/[slug]' },
    '/search': { vi: '/tim-kiem', en: '/search' },
    '/cart': { vi: '/gio-hang', en: '/cart' },
    '/checkout': { vi: '/thanh-toan', en: '/checkout' },
    '/checkout/success/[code]': { vi: '/thanh-toan/thanh-cong/[code]', en: '/checkout/success/[code]' },
    '/used-books': { vi: '/cho-sach-cu', en: '/used-books' },
    '/used-books/[id]': { vi: '/cho-sach-cu/[id]', en: '/used-books/[id]' },
    '/account': { vi: '/tai-khoan', en: '/account' },
    '/account/addresses': { vi: '/tai-khoan/dia-chi', en: '/account/addresses' },
    '/account/addresses/new': { vi: '/tai-khoan/dia-chi/moi', en: '/account/addresses/new' },
    '/account/addresses/[id]': { vi: '/tai-khoan/dia-chi/[id]', en: '/account/addresses/[id]' },
    '/account/orders': { vi: '/tai-khoan/don-hang', en: '/account/orders' },
    '/account/orders/[code]': { vi: '/tai-khoan/don-hang/[code]', en: '/account/orders/[code]' },
    '/account/my-listings': { vi: '/tai-khoan/sach-toi-ban', en: '/account/my-listings' },
    '/account/my-listings/new': { vi: '/tai-khoan/sach-toi-ban/dang-tin', en: '/account/my-listings/new' },
    '/account/my-listings/[id]': { vi: '/tai-khoan/sach-toi-ban/[id]', en: '/account/my-listings/[id]' },
    '/login': { vi: '/dang-nhap', en: '/login' },
    '/register': { vi: '/dang-ky', en: '/register' },
    '/forgot-password': { vi: '/quen-mat-khau', en: '/forgot-password' },
    '/reset-password': { vi: '/dat-lai-mat-khau', en: '/reset-password' },
    '/confirm': { vi: '/xac-nhan', en: '/confirm' },
  },
})
