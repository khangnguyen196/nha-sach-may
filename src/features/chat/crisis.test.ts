import { describe, expect, it } from 'vitest'
import { isCrisisMessage } from './crisis'

describe('isCrisisMessage', () => {
  it.each([
    'Tôi muốn chết',
    'mình KHÔNG MUỐN SỐNG nữa',
    'dạo này chán   sống quá',
    'tôi đang nghĩ tới chuyện tự tử',
    'muốn tự làm hại bản thân',
    'toi muon chet',
    'minh khong muon song nua',
    'toi dinh tu tu',
    'chan song qua',
    'I want to die',
    'thinking about suicide',
    'tôi muốn kill myself',
  ])('dương tính: %s', (message) => {
    expect(isCrisisMessage(message)).toBe(true)
  })

  it.each([
    'Từ từ thôi, gợi ý sách nhẹ nhàng',
    'tu tu thoi, cho minh sach nhe nhang',
    'cuốn này đọc chết cười',
    'cảnh đẹp muốn chết',
    'ngon muon chet',
    'Sách về sống chậm',
    'Gợi ý sách tâm lý học',
    'I want a book about dying stars',
  ])('âm tính: %s', (message) => {
    expect(isCrisisMessage(message)).toBe(false)
  })
})
