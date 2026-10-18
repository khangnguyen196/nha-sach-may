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
    hint: 'quota ẩn danh của Google Books thường đã hết',
    test: (value) => (/^AIza[0-9A-Za-z_-]{35}$/.test(value) ? null : 'không giống định dạng API key của Google (AIza…, 39 ký tự)'),
  },
  // Phase 9–10: đều tùy chọn, thiếu thì app vẫn chạy (email chỉ ghi log, VietQR dùng thông tin demo)
  {
    name: 'SITE_URL',
    required: false,
    hint: 'link trong email / sitemap dùng VERCEL_PROJECT_PRODUCTION_URL hoặc http://localhost:3000',
    test(value) {
      try {
        const url = new URL(value)
        if (url.protocol !== 'https:' && url.hostname !== 'localhost') return 'phải là https (trừ localhost)'
        return url.pathname === '/' && !url.search ? null : 'chỉ là URL gốc, không kèm đường dẫn'
      } catch {
        return 'không phải URL hợp lệ'
      }
    },
  },
  {
    name: 'RESEND_API_KEY',
    required: false,
    hint: 'email đơn hàng chỉ ghi log, không gửi',
    test: (value) => (value.startsWith('re_') ? null : 'API key của Resend bắt đầu bằng re_'),
  },
  {
    name: 'EMAIL_FROM',
    required: false,
    hint: 'cần cùng RESEND_API_KEY',
    test: (value) => (/^([^<>]+<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(value) ? null : 'dạng "Tên <email@domain>" hoặc email@domain'),
  },
  {
    name: 'VIETQR_BANK_BIN',
    required: false,
    hint: 'VietQR dùng thông tin demo (cần đủ 4 biến VIETQR_*)',
    test: (value) => (/^\d{6}$/.test(value) ? null : 'BIN ngân hàng (NAPAS) gồm 6 chữ số'),
  },
  { name: 'VIETQR_BANK_NAME', required: false, hint: 'cần đủ 4 biến VIETQR_*', test: () => null },
  {
    name: 'VIETQR_ACCOUNT_NO',
    required: false,
    hint: 'cần đủ 4 biến VIETQR_*',
    test: (value) => (/^[0-9A-Za-z]{1,19}$/.test(value) ? null : 'chỉ chữ / số, tối đa 19 ký tự'),
  },
  { name: 'VIETQR_ACCOUNT_NAME', required: false, hint: 'cần đủ 4 biến VIETQR_*', test: () => null },
  // Phase 11: chatbot Mây. Thiếu một trong hai → không có bong bóng chat (app vẫn chạy)
  {
    name: 'GEMINI_API_KEY',
    required: false,
    hint: 'chatbot Mây tắt (cần cùng CHAT_QUOTA_TOKEN)',
    // Google có thể đổi định dạng key → chỉ cảnh báo
    warnOnly: true,
    test: (value) => (/^AIza[0-9A-Za-z_-]{35}$/.test(value) ? null : 'không giống định dạng API key của Google (AIza…, 39 ký tự)'),
  },
  {
    name: 'CHAT_QUOTA_TOKEN',
    required: false,
    hint: 'chatbot Mây tắt (token sinh bằng select private.new_chat_quota_token())',
    test: (value) => (/^[0-9a-f]{64}$/.test(value) ? null : 'phải đúng 64 ký tự hex thường (kết quả của private.new_chat_quota_token())'),
  },
  {
    name: 'GEMINI_MODEL',
    required: false,
    hint: 'dùng mặc định gemini-3.5-flash-lite',
    test: (value) =>
      ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'].includes(value)
        ? null
        : 'chỉ nhận gemini-3.5-flash-lite hoặc gemini-3.1-flash-lite (src/features/chat/config.ts)',
  },
]

let failed = false
for (const { name, required, hint, test, warnOnly } of checks) {
  const raw = process.env[name]
  if (!raw) {
    console.log(`${required ? '✖' : '!'} ${name}: chưa đặt${required ? '' : ` (tùy chọn: ${hint})`}`)
    failed ||= required
    continue
  }
  // Khoảng trắng thừa luôn là lỗi; sai định dạng chỉ cảnh báo với biến warnOnly
  const whitespace = raw !== raw.trim() ? 'có khoảng trắng/xuống dòng thừa ở đầu hoặc cuối' : null
  const format = test(raw.trim())
  if (whitespace) {
    console.log(`✖ ${name}: ${[whitespace, format].filter(Boolean).join('; ')}`)
    failed = true
  } else if (format) {
    console.log(`${warnOnly ? '!' : '✖'} ${name}: ${format}${warnOnly ? ' (chỉ cảnh báo)' : ''}`)
    failed ||= !warnOnly
  } else {
    console.log(`✔ ${name}`)
  }
}

// Biến đi theo nhóm: đặt một nửa thì app bỏ qua cả nhóm (coi như chưa cấu hình)
const groups = [
  ['RESEND_API_KEY', 'EMAIL_FROM'],
  ['VIETQR_BANK_BIN', 'VIETQR_BANK_NAME', 'VIETQR_ACCOUNT_NO', 'VIETQR_ACCOUNT_NAME'],
  ['GEMINI_API_KEY', 'CHAT_QUOTA_TOKEN'],
]
for (const group of groups) {
  const set = group.filter((name) => process.env[name])
  if (set.length > 0 && set.length < group.length) {
    console.log(`✖ Đặt thiếu nhóm ${group.join(' + ')}: app sẽ bỏ qua cả nhóm`)
    failed = true
  }
}

process.exit(failed ? 1 : 0)
