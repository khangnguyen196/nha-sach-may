import type { NextConfig } from 'next'

type ImagesConfig = NonNullable<NextConfig['images']>

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

/**
 * Cấu hình `next/image` cho bìa trong Storage của project (next.config.ts). Lấy đúng host của NEXT_PUBLIC_SUPABASE_URL,
 * không wildcard *.supabase.co (wildcard cho phép tối ưu ảnh từ bucket của project khác bằng server của mình).
 *
 * Pattern http + IP local + `dangerouslyAllowLocalIP` chỉ có khi URL là Supabase local, tức bản build của e2e
 * (playwright.config.ts đặt URL local cho `next build`). Build trên Vercel (`VERCEL=1`) với URL local → ném lỗi: bản
 * deploy không bao giờ được cho /_next/image gọi vào localhost (SSRF).
 */
export function coverImagesConfig(
  supabaseUrl: string,
  { vercel }: { vercel: boolean },
): Pick<ImagesConfig, 'remotePatterns' | 'dangerouslyAllowLocalIP'> {
  const storage = new URL(supabaseUrl)
  const local = LOCAL_HOSTS.has(storage.hostname)
  if (local && vercel) throw new Error('NEXT_PUBLIC_SUPABASE_URL trỏ localhost trong bản build Vercel')
  if (!local && storage.protocol !== 'https:') throw new Error('NEXT_PUBLIC_SUPABASE_URL phải là https')
  return {
    remotePatterns: [
      {
        protocol: local ? 'http' : 'https',
        hostname: storage.hostname,
        port: storage.port,
        pathname: '/storage/v1/object/public/book-covers/**',
        search: '',
      },
    ],
    // Next 16 chặn tối ưu ảnh từ IP local nếu không bật cờ này
    dangerouslyAllowLocalIP: local,
  }
}
