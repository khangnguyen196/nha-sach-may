import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Tương phản của token màu trong globals.css (WCAG 2.x): vòng focus ≥ 3:1 với nền (1.4.11), ô "Tính năng demo" của chợ
// sách cũ (demo-note.tsx: chữ foreground ≥ 4.5:1, icon primary ≥ 3:1 trên surface-raised). Đọc thẳng file CSS: đổi mã
// màu / token mà quên kiểm lại thì test đỏ.
const SRC = join(import.meta.dirname, '..')
const css = readFileSync(join(import.meta.dirname, 'globals.css'), 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`)
  if (start < 0) throw new Error(`globals.css thiếu khối ${selector}`)
  const body = css.slice(start, css.indexOf('\n}', start))
  return Object.fromEntries(
    [...body.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map(([, name = '', value = '']) => [name, value.trim()]),
  )
}

const dark = block(':root')
// .light nằm trên <html> cùng phần tử với :root → token .light không ghi đè thì giữ giá trị của :root
const light = { ...dark, ...block('.light') }
const THEMES = { dark, light }

type Rgb = [number, number, number]

function hex(tokens: Record<string, string>, name: string): Rgb {
  const value = tokens[name]
  const digits = value && /^#([0-9a-f]{6})$/i.exec(value)?.[1]
  if (!digits) throw new Error(`--${name} không phải mã hex 6 chữ số: ${value}`)
  const n = Number.parseInt(digits, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance([r, g, b]: Rgb) {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: Rgb, b: Rgb) {
  const [la, lb] = [luminance(a), luminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Độ đục của vòng focus: `var(--primary)` = 1, `color-mix(in oklab, var(--primary) N%, transparent)` = N / 100 */
function focusAlpha(value: string | undefined) {
  if (value === 'var(--primary)') return 1
  const match = value && /^color-mix\(in oklab, var\(--primary\) (\d+(?:\.\d+)?)%, transparent\)$/.exec(value)
  if (!match) throw new Error(`--focus-ring có dạng chưa kiểm được: ${value}`)
  return Number(match[1]) / 100
}

/**
 * Ghép màu có alpha lên nền trong sRGB (cách trình duyệt vẽ). Trộn với transparent trong oklab giữ nguyên màu, chỉ giảm
 * alpha → vòng focus = primary với alpha của token.
 */
function over([r, g, b]: Rgb, alpha: number, [br, bg, bb]: Rgb): Rgb {
  const mix = (channel: number, base: number) => Math.round(channel * alpha + base * (1 - alpha))
  return [mix(r, br), mix(g, bg), mix(b, bb)]
}

const BACKGROUNDS = ['background', 'surface', 'surface-raised']

describe('vòng focus (token focus-ring) ≥ 3:1 với nền', () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    for (const background of BACKGROUNDS) {
      it(`${theme}: trên ${background}`, () => {
        const bg = hex(tokens, background)
        const ring = over(hex(tokens, 'primary'), focusAlpha(tokens['focus-ring']), bg)
        expect(contrast(ring, bg)).toBeGreaterThanOrEqual(3)
      })
    }
  }

  it('tối giữ như trước (primary 50%), sáng = primary', () => {
    expect(focusAlpha(dark['focus-ring'])).toBe(0.5)
    expect(focusAlpha(light['focus-ring'])).toBe(1)
  })
})

describe('ô "Tính năng demo" (demo-note.tsx) trên surface-raised', () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    it(`${theme}: chữ foreground ≥ 4.5:1, icon primary ≥ 3:1`, () => {
      const bg = hex(tokens, 'surface-raised')
      expect(contrast(hex(tokens, 'foreground'), bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(hex(tokens, 'primary'), bg)).toBeGreaterThanOrEqual(3)
    })
  }

  it('demo-note.tsx dùng đúng các token đã kiểm', () => {
    const source = readFileSync(join(SRC, 'features/used/components/demo-note.tsx'), 'utf8')
    expect(source).toContain('bg-surface-raised')
    expect(source).toContain('text-foreground')
    expect(source).toContain('text-primary')
  })
})

describe('lớp vòng focus', () => {
  const OLD = ['ring-ring/50', 'outline-ring/50']

  it('không còn ring-ring/50 / outline-ring/50 trong src (dùng ring-focus-ring / outline-focus-ring)', () => {
    const self = join(import.meta.dirname, 'globals.test.ts')
    const offenders = readdirSync(SRC, { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && /\.(tsx?|css)$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name))
      .filter((file) => file !== self)
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8')
        return OLD.filter((name) => source.includes(name)).map((name) => `${relative(SRC, file)}: ${name}`)
      })
    expect(offenders).toEqual([])
  })
})
