import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Hàm lõi gợi ý cảnh báo (gọi Gemini, trừ lượt) không được thành endpoint POST gọi thẳng bằng action ID: action admin
// nằm ở features/admin/**/actions.ts, tự assertAdmin ở hai câu đầu (features/admin/actions.test.ts).
const DIR = import.meta.dirname

describe("src/features/warnings không có 'use server'", () => {
  it('không file nào khai báo directive use server', () => {
    const files = readdirSync(DIR, { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name))
    expect(files.length).toBeGreaterThan(5)
    // Directive = một dòng chỉ có chuỗi (đầu file hoặc đầu thân hàm); comment nhắc tới nó không tính
    const offenders = files.filter((file) => /^\s*['"]use server['"];?\s*$/m.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
