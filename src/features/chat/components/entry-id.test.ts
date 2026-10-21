import { describe, expect, it } from 'vitest'
import type { ChatEntry } from './chat-state'
import { appendEntry } from './entry-id'

const user = (id: number, text = 'câu hỏi'): ChatEntry => ({ id, role: 'user', text })

describe('appendEntry', () => {
  it('danh sách rỗng → id 0', () => {
    expect(appendEntry([], { role: 'user', text: 'a' })).toEqual([{ id: 0, role: 'user', text: 'a' }])
  })

  it('nhiều mục → id lớn nhất + 1, giữ nguyên các mục cũ', () => {
    const entries = [user(0), { id: 1, role: 'error', code: 'NETWORK_ERROR' } satisfies ChatEntry, user(2)]
    const next = appendEntry(entries, { role: 'error', code: 'RATE_LIMITED' })
    expect(next.slice(0, 3)).toEqual(entries)
    expect(next[3]).toEqual({ id: 3, role: 'error', code: 'RATE_LIMITED' })
  })

  it('id không liên tục / không theo thứ tự → vẫn lớn hơn mọi id đang có', () => {
    expect(appendEntry([user(5), user(2), user(9)], { role: 'user', text: 'b' }).at(-1)?.id).toBe(10)
  })

  it('hai lượt thêm nối tiếp (lượt trả lời cũ về sau khi đã có câu mới) không trùng id', () => {
    // Bản ChatPanel cũ gửi câu 0 rồi bị gỡ; bản mới gửi câu tiếp theo; trả lời của bản cũ về sau
    const afterNewQuestion = appendEntry([user(0)], { role: 'user', text: 'câu mới' })
    const afterOldReply = appendEntry(afterNewQuestion, { role: 'error', code: 'NETWORK_ERROR' })
    expect(new Set(afterOldReply.map((entry) => entry.id)).size).toBe(afterOldReply.length)
  })

  it('không đổi mảng đầu vào', () => {
    const entries = [user(0)]
    appendEntry(entries, { role: 'user', text: 'c' })
    expect(entries).toEqual([user(0)])
  })
})
