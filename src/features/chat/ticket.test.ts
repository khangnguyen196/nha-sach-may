import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vé gọi Gemini chỉ được cấp sau khi một RPC trừ lượt thành công: consume_chat_quota (Mây) hoặc consume_warning_quota
// (gợi ý cảnh báo, cộng cả bucket chung gemini:*). Thêm chỗ cấp vé mới mà không qua bộ đếm thì test này fail.
const SRC = join(import.meta.dirname, '../..')
const ALLOWED = ['features/chat/quota.ts', 'features/warnings/quota.ts']

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

describe('GeminiTicket.issue', () => {
  it('chỉ chat/quota.ts và warnings/quota.ts cấp vé (ngoài *.test.ts)', () => {
    const issuers = sourceFiles(SRC)
      .filter((file) => /GeminiTicket\s*\.\s*issue\s*\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file).replaceAll('\\', '/'))
      .sort()
    expect(issuers).toEqual(ALLOWED)
  })
})
