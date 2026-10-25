import { createFormatter, createTranslator } from 'use-intl/core'
import { describe, expect, it, vi } from 'vitest'
import en from '../../../../messages/en.json'
import vi_ from '../../../../messages/vi.json'
import { formats } from '@/i18n/formats'

// Câu WARNING_QUOTA_EXCEEDED theo scope với bản dịch thật (messages + formats + múi giờ của app).
vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: 'vi'; namespace: 'admin.warnings.quota' }) =>
    createTranslator({ locale, messages: vi_, namespace, formats, timeZone: 'Asia/Ho_Chi_Minh' }),
  getFormatter: async ({ locale }: { locale: 'vi' }) => createFormatter({ locale, formats, timeZone: 'Asia/Ho_Chi_Minh' }),
}))

const { warningQuotaFailure, warningQuotaKind } = await import('./quota-message')

// 07:00 UTC = nửa đêm Los Angeles (PDT) = 14:00 giờ Việt Nam
const RESET = new Date('2026-10-26T07:00:00Z')

describe('WARNING_QUOTA_EXCEEDED theo scope', () => {
  it('phút (warn_minute, gemini_minute): thử lại sau ít phút, không nói tới Mây', async () => {
    for (const scope of ['warn_minute', 'gemini_minute'] as const) {
      expect(warningQuotaKind(scope)).toBe('minute')
      const failure = await warningQuotaFailure(scope, RESET)
      expect(failure).toMatchObject({ ok: false, code: 'WARNING_QUOTA_EXCEEDED' })
      expect(failure.message).toBe(vi_.admin.warnings.quota.minute)
      expect(failure.message).toContain('thử lại sau ít phút')
    }
  })

  it('ngày (warn_day, gemini_day): hết lượt hôm nay + giờ reset theo giờ Việt Nam, không nói tới Mây', async () => {
    for (const scope of ['warn_day', 'gemini_day'] as const) {
      expect(warningQuotaKind(scope)).toBe('day')
      const { message } = await warningQuotaFailure(scope, RESET)
      expect(message).toContain('hôm nay')
      expect(message).toContain('14:00')
      expect(message).toContain('giờ Việt Nam')
      expect(message).not.toContain('Mây')
    }
    expect((await warningQuotaFailure('warn_day', null)).message).toBe(vi_.admin.warnings.quota.dayNoTime)
  })

  it('chat_reserve: hết lượt hôm nay, chừa lượt cho chatbot Mây, kèm giờ reset', async () => {
    expect(warningQuotaKind('chat_reserve')).toBe('chatReserve')
    const { message } = await warningQuotaFailure('chat_reserve', RESET)
    expect(message).toContain('chừa cho chatbot Mây')
    expect(message).toContain('14:00')
    expect((await warningQuotaFailure('chat_reserve', null)).message).toBe(vi_.admin.warnings.quota.chatReserveNoTime)
  })

  it('chỉ câu chat_reserve nói tới Mây; scope null → không gắn message (form hiện câu chung trung tính)', async () => {
    const quota = vi_.admin.warnings.quota
    for (const [key, text] of Object.entries(quota)) {
      expect(text.includes('Mây'), key).toBe(key.startsWith('chatReserve'))
    }
    const failure = await warningQuotaFailure(null, RESET)
    expect(failure).toEqual({ ok: false, code: 'WARNING_QUOTA_EXCEEDED' })
    expect(vi_.errors.WARNING_QUOTA_EXCEEDED).not.toContain('Mây')
    expect(en.errors.WARNING_QUOTA_EXCEEDED).not.toContain('Mây')
  })
})
