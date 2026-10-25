import { describe, expect, it } from 'vitest'
import { ALLOWED_MODELS, BLOCKED_COUNTRIES, CHAT_LIMITS, DEFAULT_MODEL, FREE_TIER, GEMINI, WARNING_LIMITS } from './config'

describe('giới hạn chatbot', () => {
  // Gợi ý cảnh báo cộng vào cùng gemini:minute / gemini:day mà Mây dừng ở hai trần này → đây cũng là trần tổng mọi
  // lượt gọi Gemini của cả web (Mây + gợi ý)
  it.each(ALLOWED_MODELS)('trần chung (Mây + gợi ý cảnh báo) thấp hơn free tier của %s', (model) => {
    const tier = FREE_TIER.limits[model]
    expect(CHAT_LIMITS.geminiCallsPerMinute).toBeLessThan(tier.rpm)
    expect(CHAT_LIMITS.geminiCallsPerDay).toBeLessThan(tier.rpd)
    // mỗi lượt < 8K token vào → 10 lượt / phút vẫn xa TPM
    expect(CHAT_LIMITS.geminiCallsPerMinute * GEMINI.targetPromptTokens).toBeLessThan(tier.tpm)
    expect(GEMINI.maxPromptTokens).toBeLessThanOrEqual(GEMINI.targetPromptTokens)
  })

  it('model mặc định nằm trong danh sách cho phép', () => {
    expect(ALLOWED_MODELS).toContain(DEFAULT_MODEL)
  })

  it('theo khách 10 câu / giờ, 30 / ngày; theo IP 60 / 200', () => {
    expect(CHAT_LIMITS).toMatchObject({ visitorPerHour: 10, visitorPerDay: 30, ipPerHour: 60, ipPerDay: 200 })
  })

  it('32 mã nước bị chặn: 27 EU + IS, LI, NO + GB + CH, không trùng', () => {
    expect(BLOCKED_COUNTRIES).toHaveLength(32)
    expect(new Set(BLOCKED_COUNTRIES).size).toBe(32)
    for (const code of ['IS', 'LI', 'NO', 'GB', 'CH', 'DE', 'FR', 'IE']) expect(BLOCKED_COUNTRIES).toContain(code)
    expect(BLOCKED_COUNTRIES).not.toContain('VN')
  })
})

// Gợi ý cảnh báo dùng cùng khóa + model với Mây, đếm chung gemini:minute / gemini:day (quyết định chủ dự án 2026-10-25).
// Ngưỡng thật trong SQL: supabase/prefs-warnings.test.ts kiểm khớp với các số này.
describe('hạn mức gợi ý cảnh báo (đếm chung với Mây)', () => {
  it('trần riêng theo ngày không vượt trần cứng của SQL', () => {
    expect(WARNING_LIMITS.callsPerDay).toBeLessThanOrEqual(WARNING_LIMITS.hardCallsPerDay)
  })

  it('trần riêng theo phút thấp hơn trần phút chung: Mây vẫn còn lượt trong cùng phút', () => {
    expect(WARNING_LIMITS.callsPerMinute).toBeLessThan(CHAT_LIMITS.geminiCallsPerMinute)
  })

  it('chừa cho Mây xong vẫn đủ chỗ cho trần cứng của gợi ý', () => {
    expect(WARNING_LIMITS.chatReserve).toBeGreaterThan(0)
    expect(CHAT_LIMITS.geminiCallsPerDay - WARNING_LIMITS.chatReserve).toBeGreaterThan(WARNING_LIMITS.hardCallsPerDay)
  })

  it('một lượt gợi ý tối đa 12 sách; lô giãn ≥ 30 giây giữa các lượt', () => {
    expect(WARNING_LIMITS.booksPerCall).toBe(12)
    expect(60_000 / WARNING_LIMITS.callsPerMinute).toBeGreaterThanOrEqual(30_000)
  })
})
