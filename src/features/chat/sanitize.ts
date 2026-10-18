// Làm sạch chữ đi vào / ra khỏi AI. Không dùng zod: hàm thuần, dùng chung server và test.

// Ký tự điều khiển (trừ xuống dòng / tab), ký tự định hướng (bidi) và zero-width hay dùng để giấu chỉ dẫn
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g
// Thẻ bọc câu của khách trong prompt: mọi biến thể hoa / thường, khoảng trắng, dấu /
const KHACH_TAG = /<\s*\/?\s*khach\s*>/gi

/** Câu của khách / lượt lịch sử trước khi đưa vào prompt */
export function cleanInput(text: string): string {
  return text.normalize('NFC').replace(CONTROL, '').replace(KHACH_TAG, '').replace(/[ \t]+/g, ' ').trim()
}

const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+/gi
const TAG_LIKE = /<[^>]*>/g

/** Chữ do AI viết: chỉ văn bản thuần, bỏ link / thẻ, gộp khoảng trắng, cắt độ dài */
export function cleanOutput(text: string, max: number): string {
  const cleaned = text.normalize('NFC').replace(CONTROL, '').replace(TAG_LIKE, '').replace(URL_LIKE, '').replace(/\s+/g, ' ').trim()
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1).trimEnd()}…`
}
