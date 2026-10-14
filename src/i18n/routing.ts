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
    '/books/[slug]': { vi: '/sach/[slug]', en: '/books/[slug]' },
    '/authors/[slug]': { vi: '/tac-gia/[slug]', en: '/authors/[slug]' },
    '/search': { vi: '/tim-kiem', en: '/search' },
    '/cart': { vi: '/gio-hang', en: '/cart' },
    '/checkout': { vi: '/thanh-toan', en: '/checkout' },
    '/account': { vi: '/tai-khoan', en: '/account' },
  },
})
