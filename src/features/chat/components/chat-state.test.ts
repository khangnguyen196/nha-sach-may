import { describe, expect, it } from 'vitest'
import type { ChatReply } from '../actions'
import { recentTurns, visibleSuggestion, type ChatEntry } from './chat-state'

const reply = (followUp: string | null): ChatReply => ({
  kind: 'answer',
  message: 'Mây gợi ý.',
  books: [],
  followUp,
  languageNotice: false,
  aboutBook: null,
  turn: { user: 'câu hỏi', model: { message: 'Mây gợi ý.', follow_up: followUp ?? '', slugs: [] } },
})

const user = (id: number): ChatEntry => ({ id, role: 'user', text: 'câu hỏi' })
const answer = (id: number, followUp: string | null = `Hỏi tiếp ${id}?`): ChatEntry => ({ id, role: 'assistant', reply: reply(followUp) })
const error = (id: number): ChatEntry => ({ id, role: 'error', code: 'CHAT_UNAVAILABLE' })

describe('visibleSuggestion', () => {
  it('chưa hỏi gì → chip ban đầu; đang chờ câu đầu → không gợi ý nào', () => {
    expect(visibleSuggestion([], false)).toEqual({ kind: 'chips' })
    expect(visibleSuggestion([], true)).toEqual({ kind: 'none' })
  })

  it('lượt mới nhất là câu trả lời của Mây → chỉ follow_up của lượt đó', () => {
    expect(visibleSuggestion([user(0), answer(1)], false)).toEqual({ kind: 'followUp', entryId: 1 })
    expect(visibleSuggestion([user(0), answer(1), user(2), answer(3)], false)).toEqual({ kind: 'followUp', entryId: 3 })
  })

  it('khách vừa gửi câu tiếp theo (đang chờ) → follow_up cũ ẩn, không gợi ý nào', () => {
    expect(visibleSuggestion([user(0), answer(1), user(2)], true)).toEqual({ kind: 'none' })
    expect(visibleSuggestion([user(0), answer(1), user(2)], false)).toEqual({ kind: 'none' })
  })

  it('lượt cuối là lỗi, hoặc câu trả lời không có follow_up → không gợi ý nào', () => {
    expect(visibleSuggestion([user(0), answer(1), user(2), error(3)], false)).toEqual({ kind: 'none' })
    expect(visibleSuggestion([user(0), answer(1, null)], false)).toEqual({ kind: 'none' })
  })
})

describe('recentTurns', () => {
  it('lịch sử gửi server vẫn giữ follow_up của mọi lượt cũ (chỉ ẩn trên giao diện)', () => {
    const turns = recentTurns([user(0), answer(1, 'Tư duy hay quản trị?'), user(2), answer(3, 'Sách ngắn nhé?')])
    expect(turns.map((turn) => turn.model.follow_up)).toEqual(['Tư duy hay quản trị?', 'Sách ngắn nhé?'])
  })
})
