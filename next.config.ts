import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// Next nạp .env.local trước khi đọc file này. Lấy đúng host của project, không dùng wildcard *.supabase.co
// (wildcard cho phép tối ưu ảnh từ bucket của project khác bằng server của mình).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL (chạy npm run check:env)')

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Ảnh bìa đã tải về Supabase Storage (scripts/import-books.ts), không hotlink Google Books
    remotePatterns: [
      {
        protocol: 'https',
        hostname: new URL(supabaseUrl).hostname,
        pathname: '/storage/v1/object/public/book-covers/**',
        search: '',
      },
    ],
    qualities: [75],
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default withNextIntl(nextConfig)
