import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHAT_SPEC_CALLS, WARNING_SPEC_CALLS } from '../e2e/gemini-budget'
import { CHAT_LIMITS, WARNING_LIMITS } from '../src/features/chat/config'

// Bất biến hạn mức NGÀY của e2e trên CI (e2e/gemini-budget.ts): AI giả không nhân trần ngày, mọi spec của một lượt CI
// dùng chung một DB local. Số project chạy mỗi spec + số lần retry đọc từ playwright.config.ts (không import được: file
// config gọi `supabase status` lúc nạp).

const root = join(import.meta.dirname, '..')
const e2eDir = join(root, 'e2e')
const config = readFileSync(join(root, 'playwright.config.ts'), 'utf8')
const specs = readdirSync(e2eDir).filter((file) => file.endsWith('.spec.ts'))
const source = (file: string) => readFileSync(join(e2eDir, file), 'utf8')
/** Bỏ comment dòng (`// …`) để không đếm lời gọi nằm trong comment */
const code = (file: string) => source(file).replace(/^\s*\/\/.*$/gm, '')

function configRegex(name: string): RegExp {
  const match = new RegExp(`const ${name} = /(.+)/\\n`).exec(config)
  if (!match?.[1]) throw new Error(`playwright.config.ts không có ${name}`)
  return new RegExp(match[1])
}

const ACCOUNT_SPECS = configRegex('ACCOUNT_SPECS')
const ADMIN_SPECS = configRegex('ADMIN_SPECS')
const ADMIN_MOBILE_SPECS = configRegex('ADMIN_MOBILE_SPECS')

/** Project chạy spec, theo testMatch / testIgnore của playwright.config.ts */
function projectsOf(file: string): string[] {
  if (ADMIN_SPECS.test(file)) return ['desktop-admin', ...(ADMIN_MOBILE_SPECS.test(file) ? ['mobile-admin'] : [])]
  if (ACCOUNT_SPECS.test(file)) return ['desktop-account', 'mobile-account']
  return ['desktop', 'mobile']
}

const ciRetries = Number(/retries: process\.env\.CI \? (\d+) : 0/.exec(config)?.[1] ?? Number.NaN)
const attempts = 1 + ciRetries

const total = (calls: Readonly<Record<string, number>>) =>
  Object.entries(calls).reduce((sum, [file, perRun]) => sum + perRun * projectsOf(file).length, 0)

const countMatches = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].length

describe('e2e/gemini-budget.ts: bất biến hạn mức ngày trên CI', () => {
  it('đọc được cấu hình Playwright: retries của CI, project theo tên spec', () => {
    expect(ciRetries).toBe(2)
    expect(projectsOf('admin-warnings.spec.ts')).toEqual(['desktop-admin'])
    expect(projectsOf('admin-smoke.spec.ts')).toEqual(['desktop-admin', 'mobile-admin'])
    expect(projectsOf('chat.spec.ts')).toEqual(['desktop', 'mobile'])
    expect(projectsOf('chat-account.spec.ts')).toEqual(['desktop-account', 'mobile-account'])
    // Các project trên còn đúng như trong config (đổi tên / thêm project thì sửa projectsOf)
    for (const project of ['desktop', 'mobile', 'desktop-account', 'mobile-account', 'desktop-admin', 'mobile-admin']) {
      expect(config).toContain(`name: '${project}'`)
    }
  })

  it('warn:day: lượt gợi ý hợp lệ của mọi spec × (1 + retries) < WARNING_LIMITS.callsPerDay', () => {
    expect(total(WARNING_SPEC_CALLS) * attempts).toBeLessThan(WARNING_LIMITS.callsPerDay)
  })

  it('gemini:day: (lượt gợi ý + ước lượt chat của mọi spec) × (1 + retries) < ngưỡng chat_reserve 400 − 100', () => {
    const ceiling = CHAT_LIMITS.geminiCallsPerDay - WARNING_LIMITS.chatReserve
    expect((total(WARNING_SPEC_CALLS) + total(CHAT_SPEC_CALLS)) * attempts).toBeLessThan(ceiling)
  })

  it('mọi spec gọi AI gợi ý cảnh báo / consume_warning_quota đều khai báo, số khai báo khớp số lời gọi', () => {
    const using = specs.filter((file) => /suggestOne\(|startBatch\(|consume_warning_quota/.test(code(file)))
    expect(using.toSorted()).toEqual(Object.keys(WARNING_SPEC_CALLS).toSorted())
    const warnings = code('admin-warnings.spec.ts')
    // Lời gọi helper (bỏ định nghĩa `async function suggestOne(`)
    const calls = countMatches(warnings, /await (suggestOne|startBatch)\(/g)
    expect(calls).toBe(WARNING_SPEC_CALLS['admin-warnings.spec.ts'])
    // Spec RLS: lượt hợp lệ duy nhất gọi bằng adminClient (lời gọi qua adminLoose / khách / thành viên bị từ chối trước
    // bộ đếm)
    const rls = code('admin-prefs-warnings-rls.spec.ts')
    expect(countMatches(rls, /adminClient\.rpc\('consume_warning_quota'/g)).toBe(
      WARNING_SPEC_CALLS['admin-prefs-warnings-rls.spec.ts'],
    )
    // Chỉ spec của e2e mới bấm nút gợi ý (spec khác bấm sẽ trừ lượt mà không khai báo)
    for (const file of specs.filter((spec) => !using.includes(spec))) {
      expect(source(file), file).not.toMatch(/Gợi ý bằng AI|Gợi ý cho sách chưa xét/)
    }
  })

  it('mọi spec hỏi Mây / gọi consume_chat_quota đều khai báo, số khai báo ≥ số chỗ gọi trong code', () => {
    const using = specs.filter((file) => /\bask\(|consume_chat_quota/.test(code(file)))
    expect(using.toSorted()).toEqual(Object.keys(CHAT_SPEC_CALLS).toSorted())
    for (const file of using) {
      const text = code(file)
      // Chỗ gọi (vòng lặp chỉ đếm một lần: số khai báo tính đủ số vòng) + bấm chip gợi ý
      const sites =
        countMatches(text, /\bask\(/g) +
        countMatches(text, /(?<!function )\bconsume\(/g) +
        countMatches(text, /chips\.getByRole\('button'[^)]*\)\s*\.click\(/g)
      expect(CHAT_SPEC_CALLS[file], file).toBeGreaterThanOrEqual(sites)
    }
  })
})
