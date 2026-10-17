import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Cấu hình next/font/local là literal (next/font không cho sinh bằng hàm) → kiểm bằng cách đọc nguồn:
// đủ file, đúng độ đậm đang dùng (Be Vietnam Pro 400/500/600, Lora 500/600), đủ 3 subset, chỉ latin-ext không preload.
const source = readFileSync('src/app/fonts.ts', 'utf8')
const paths = [...source.matchAll(/path: '\.\.\/assets\/fonts\/([^']+)'/g)].map((match) => match[1] ?? '')

describe('font tự host (src/app/fonts.ts)', () => {
  it('12 file, mỗi file có thật trong src/assets/fonts', () => {
    expect(paths).toHaveLength(12)
    for (const file of paths) {
      expect(existsSync(`src/assets/fonts/${file}`), file).toBe(true)
      expect(statSync(`src/assets/fonts/${file}`).size).toBeGreaterThan(1_000)
    }
  })

  it('đủ độ đậm × subset đang dùng', () => {
    const expected = [
      ...['400', '500', '600'].flatMap((weight) =>
        ['latin', 'latin-ext', 'vietnamese'].map((subset) => `be-vietnam-pro-${weight}-${subset}.woff2`),
      ),
      ...['latin', 'latin-ext', 'vietnamese'].map((subset) => `lora-500-600-${subset}.woff2`),
    ]
    expect([...paths].sort()).toEqual(expected.sort())
  })

  it('mỗi lần gọi localFont có unicode-range; chỉ 2 subset latin-ext tắt preload; giấy phép OFL đi kèm', () => {
    expect(source.match(/prop: 'unicode-range'/g)).toHaveLength(6)
    expect(source.match(/preload: false/g)).toHaveLength(2)
    expect(existsSync('src/assets/fonts/OFL-BeVietnamPro.txt')).toBe(true)
    expect(existsSync('src/assets/fonts/OFL-Lora.txt')).toBe(true)
  })

  it('globals.css ghép đủ biến font theo thứ tự latin → latin-ext → vietnamese → fallback', () => {
    const css = readFileSync('src/app/globals.css', 'utf8').replace(/\s+/g, ' ')
    expect(css).toContain(
      "--font-sans: var(--font-be-vietnam-pro-latin), var(--font-be-vietnam-pro-latin-ext), var(--font-be-vietnam-pro-vietnamese), 'Be Vietnam Pro Fallback';",
    )
    expect(css).toContain(
      "--font-serif: var(--font-lora-latin), var(--font-lora-latin-ext), var(--font-lora-vietnamese), 'Lora Fallback';",
    )
  })
})
