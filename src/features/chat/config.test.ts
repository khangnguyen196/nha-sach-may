import { describe, expect, it } from 'vitest'
import { ALLOWED_MODELS, BLOCKED_COUNTRIES, CHAT_LIMITS, DEFAULT_MODEL, FREE_TIER, GEMINI } from './config'

describe('giới hạn chatbot', () => {
  it.each(ALLOWED_MODELS)('trần chung thấp hơn free tier của %s', (model) => {
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
