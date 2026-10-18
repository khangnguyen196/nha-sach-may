/**
 * Env cho e2e: CHỈ Supabase local (Docker, `npx supabase start`, cấu hình supabase/config.toml).
 *
 * Khóa lấy từ `supabase status -o env` (khóa demo của stack local, không phải bí mật), KHÔNG đọc file env nào
 * (.env.local trỏ production). Ghi đè NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY /
 * SUPABASE_SERVICE_ROLE_KEY trong process.env để biến còn sót từ shell không lọt vào. Không in giá trị.
 *
 * Dùng ở playwright.config.ts (main process + mọi worker), scripts/e2e-user.ts, scripts/e2e-seed.ts, e2e/mailbox.ts.
 */
import { execSync } from 'node:child_process'

/** Project production: e2e tạo / xóa user, đơn, sách test → không bao giờ chạy trên đó */
export const PRODUCTION_SUPABASE_REF = 'ylfgwcxddxvfxwldmwtf'

/**
 * CHAT_QUOTA_TOKEN của e2e (chatbot Mây): token cố định cho Supabase local, KHÔNG phải bí mật. Playwright đặt vào
 * webServer.env; e2e-seed.ts ghi sha256 vào DB local qua set_chat_quota_token (chỉ service_role).
 */
export const E2E_CHAT_QUOTA_TOKEN = '0123456789abcdef'.repeat(4)
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

/** URL Supabase của e2e: từ chối production và mọi host không phải 127.0.0.1 / localhost */
export function assertLocalSupabase(url: string | undefined): string {
  if (!url) throw new Error('Thiếu URL Supabase cho e2e (chạy npx supabase start)')
  if (url.includes(PRODUCTION_SUPABASE_REF)) {
    throw new Error('Đây là project Supabase production: e2e chỉ chạy trên Supabase local (npx supabase start)')
  }
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    throw new Error('URL Supabase cho e2e không hợp lệ')
  }
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error('e2e chỉ chạy trên Supabase local (127.0.0.1 / localhost), không chạy trên project cloud')
  }
  return url
}

/** Dòng KEY="value" của `supabase status -o env` */
export function parseStatusEnv(output: string): Map<string, string> {
  const vars = new Map<string, string>()
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(?:"(.*)"|(.*))$/.exec(line.trim())
    if (match?.[1]) vars.set(match[1], match[2] ?? match[3] ?? '')
  }
  return vars
}

export type LocalSupabase = {
  url: string
  publishableKey: string
  serviceRoleKey: string
  /** Hộp thư giả Mailpit ([local_smtp] trong config.toml) */
  mailUrl: string
}

let cached: LocalSupabase | undefined

function status() {
  // CI: CLI cài bằng supabase/setup-cli (có trên PATH). Máy dev: qua npx (bản đã tải).
  for (const command of ['supabase status -o env', 'npx --no-install supabase status -o env']) {
    try {
      return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
      /* thử lệnh tiếp theo */
    }
  }
  throw new Error('Không đọc được Supabase local: cần Docker + `npx supabase start` (supabase/config.toml)')
}

/** Đọc Supabase local một lần mỗi process, ghi vào process.env, kiểm URL bằng assertLocalSupabase */
export function loadLocalSupabase(): LocalSupabase {
  if (cached) return cached
  const vars = parseStatusEnv(status())
  const url = assertLocalSupabase(vars.get('API_URL'))
  const publishableKey = vars.get('PUBLISHABLE_KEY') || vars.get('ANON_KEY')
  const serviceRoleKey = vars.get('SERVICE_ROLE_KEY') || vars.get('SECRET_KEY')
  if (!publishableKey || !serviceRoleKey) throw new Error('`supabase status` không có publishable / service role key')
  const mailUrl = assertLocalSupabase(vars.get('MAILPIT_URL') || vars.get('INBUCKET_URL') || 'http://127.0.0.1:54324')
  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishableKey
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey
  cached = { url, publishableKey, serviceRoleKey, mailUrl }
  return cached
}
