// Chỉ dùng trong Vitest (blocks.test.ts, features/used/market-blocks.test.ts): Vitest chạy môi trường node, không có
// DOM để thử selector thật.

/**
 * Khớp CSS của blockCss với data-* của một khung thẻ như trình duyệt (chỉ đúng dạng selector của blockCss: `=`, `~=`
 * trong một `:is(…)`).
 */
export function cssHidesSlot(css: string, attributes: Record<string, string | undefined>): boolean {
  const conditions = /:is\(([^)]*)\)/.exec(css)?.[1]
  if (!conditions) return false
  return conditions.split(',').some((condition) => {
    const match = /^\[(data-[a-z]+)(~?=)"([^"]+)"\]$/.exec(condition)
    if (!match) throw new Error(`điều kiện lạ: ${condition}`)
    const [, name = '', operator, value = ''] = match
    const actual = attributes[name]
    if (actual === undefined) return false
    return operator === '=' ? actual === value : actual.split(/\s+/).includes(value)
  })
}
