// Kiểm tra .env.local mà KHÔNG in giá trị bí mật. Chỉ báo biến nào thiếu / sai định dạng.
//   npm run check:env
import { existsSync } from 'node:fs'

const FILE = '.env.local'

if (!existsSync(FILE)) {
  console.error(`✖ Không có ${FILE}. Copy từ .env.example rồi điền.`)
  process.exit(1)
}
process.loadEnvFile(FILE)

const checks = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    test(value) {
      let url
      try {
        url = new URL(value)
      } catch {
        return 'không phải URL hợp lệ'
      }
      if (url.protocol !== 'https:') return 'phải là https'
      if (!url.hostname.endsWith('.supabase.co')) return 'host phải có dạng <project-id>.supabase.co'
      if (url.pathname !== '/' || url.search) return 'phải là URL gốc, không kèm đường dẫn (VD: /rest/v1) hay query'
      return null
    },
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    required: true,
    test: (value) =>
      value.startsWith('sb_publishable_') || value.split('.').length === 3
        ? null
        : 'phải là publishable key (sb_publishable_…) hoặc anon key (JWT)',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    test: (value) =>
      value.startsWith('sb_publishable_')
        ? 'đang là publishable key, cần secret key (sb_secret_…) hoặc service_role key'
        : value.startsWith('sb_secret_') || value.split('.').length === 3
          ? null
          : 'phải là secret key (sb_secret_…) hoặc service_role key (JWT)',
  },
  {
    name: 'GOOGLE_BOOKS_API_KEY',
    required: false,
    test: (value) => (/^AIza[0-9A-Za-z_-]{35}$/.test(value) ? null : 'không giống định dạng API key của Google (AIza…, 39 ký tự)'),
  },
]

let failed = false
for (const { name, required, test } of checks) {
  const raw = process.env[name]
  if (!raw) {
    console.log(`${required ? '✖' : '!'} ${name}: chưa đặt${required ? '' : ' (tùy chọn, nhưng quota ẩn danh của Google Books thường đã hết)'}`)
    failed ||= required
    continue
  }
  const problems = [raw !== raw.trim() ? 'có khoảng trắng/xuống dòng thừa ở đầu hoặc cuối' : null, test(raw.trim())].filter(Boolean)
  if (problems.length > 0) {
    console.log(`✖ ${name}: ${problems.join('; ')}`)
    failed = true
  } else {
    console.log(`✔ ${name}`)
  }
}

process.exit(failed ? 1 : 0)
