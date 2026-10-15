import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin({
  requestConfig: './src/i18n/request.ts',
  experimental: {
    // Biên dịch ICU message lúc build → client chỉ cần bộ format nhỏ, bỏ được intl-messageformat (~16KB gzip)
    // khỏi bundle đầu (IntlProvider kéo nó vào dù không client leaf nào gọi useTranslations).
    messages: { path: './messages', format: 'json', locales: 'infer', precompile: true },
  },
})

// Next nạp .env.local trước khi đọc file này. Lấy đúng host của project, không dùng wildcard *.supabase.co
// (wildcard cho phép tối ưu ảnh từ bucket của project khác bằng server của mình).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL (chạy npm run check:env)')

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Upload bìa ở admin: file ≤ 4MB (COVER_MAX_BYTES) + các ô khác của form; body request của Vercel tối đa 4.5MB.
    // Next chưa cho đặt theo từng action nên áp cho mọi Server Action.
    serverActions: { bodySizeLimit: '4.5mb' },
  },
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
