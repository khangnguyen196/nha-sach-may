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

// Sáng là mặc định (:root); .dark nằm trên <html> cùng phần tử với :root → token .dark không ghi đè thì giữ giá trị của
// :root (alias như --card: var(--surface))
const light = block(':root')
const dark = { ...light, ...block('.dark') }
const THEMES = { light, dark }

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

  it('tối = primary 50%, sáng = primary', () => {
    expect(focusAlpha(dark['focus-ring'])).toBe(0.5)
    expect(focusAlpha(light['focus-ring'])).toBe(1)
  })
})

describe('nhãn giảm giá (sale, sale-foreground)', () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    it(`${theme}: chữ sale ≥ 4.5:1 trên background / surface / surface-raised, sale-foreground ≥ 4.5:1 trên nền sale`, () => {
      for (const background of BACKGROUNDS) {
        expect(contrast(hex(tokens, 'sale'), hex(tokens, background)), background).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrast(hex(tokens, 'sale-foreground'), hex(tokens, 'sale'))).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('sale sáng = #b83c0b (chủ dự án chọn 2026-11-20)', () => {
    expect(light.sale).toBe('#b83c0b')
  })
})

// Thẻ promo ở hàng khuyến mãi trang chủ (features/home): nền chuyển màu promo-from → promo-to, mọi điểm của nền nằm
// giữa hai đầu nên kiểm ở hai đầu là đủ
const PROMO_BACKGROUNDS = ['promo-from', 'promo-to']

describe('khu khuyến mãi (promo-*)', () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    for (const background of PROMO_BACKGROUNDS) {
      it(`${theme}: chữ promo-foreground / promo-accent / promo-muted ≥ 4.5:1 trên ${background}`, () => {
        const bg = hex(tokens, background)
        for (const text of ['promo-foreground', 'promo-accent', 'promo-muted']) {
          expect(contrast(hex(tokens, text), bg), text).toBeGreaterThanOrEqual(4.5)
        }
      })

      it(`${theme}: vòng focus trong thẻ promo (promo-accent đặc) ≥ 3:1 trên ${background}`, () => {
        expect(contrast(hex(tokens, 'promo-accent'), hex(tokens, background))).toBeGreaterThanOrEqual(3)
      })
    }
  }
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
  // Mọi vòng / outline màu ring hoặc primary có độ đục riêng (ring-ring/50, focus-visible:ring-primary/40,
  // ring-primary/[0.4], ring-primary/(--x)…) bỏ qua token
  const OLD = /\b(ring|outline)-(ring|primary)\/(\d+|\[[^\]]+\]|\([^)]+\))/g

  it('không lớp (ring|outline)-(ring|primary)/N trong src (dùng ring-focus-ring / outline-focus-ring)', () => {
    const self = join(import.meta.dirname, 'globals.test.ts')
    const offenders = readdirSync(SRC, { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && /\.(tsx?|css)$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name))
      .filter((file) => file !== self)
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8')
        return [...source.matchAll(OLD)].map(([name]) => `${relative(SRC, file)}: ${name}`)
      })
    expect(offenders).toEqual([])
  })
})

describe('nút chính (button.tsx, variant default): khoảng hở màu nền giữa nút và vòng focus', () => {
  // Giao diện sáng: vòng focus-ring = primary 100% = đúng màu nền nút → trông như nút to thêm 3px. Khoảng hở màu
  // background tách vòng khỏi nút; vòng đứng trên khoảng hở đó nên tương phản cần là vòng / background (kiểm ở trên).
  const source = readFileSync(join(SRC, 'components/ui/button.tsx'), 'utf8')
  // Chỉ khối `variant: { … }` (khối `size` cũng có khóa default)
  const block = source.slice(source.indexOf('variant: {'), source.indexOf('size: {'))
  const variants = Object.fromEntries(
    [...block.matchAll(/^\s+(\w+):\s*"([^"]*)",?$/gm)].map(([, name = '', classes = '']) => [name, classes]),
  )

  it('default có ring-offset-2 bằng token background', () => {
    expect(variants.default?.split(' ')).toEqual(
      expect.arrayContaining(['focus-visible:ring-offset-2', 'focus-visible:ring-offset-background']),
    )
  })

  it('các variant khác không đổi (không ring-offset)', () => {
    for (const name of ['outline', 'secondary', 'ghost', 'destructive', 'link']) {
      expect(variants[name], name).toBeDefined()
      expect(variants[name], name).not.toContain('ring-offset')
    }
  })
})
