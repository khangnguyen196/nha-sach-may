// Hàm thuần cho palette tìm kiếm, chạy ở client. KHÔNG import zod: zod vào chunk palette tốn ~30KB gzip (CLAUDE.md →
// Hiệu năng). Server (/api/search, catalogParamsSchema) vẫn parse từ khóa bằng searchQuerySchema (schemas.ts);
// searchResponseSchema là hợp đồng JSON của /api/search (nguồn kiểu SearchHit). search-input.test.ts kiểm hàm tay và hai
// schema zod cho cùng kết quả trên cùng bộ input.
import type { SearchHit } from './schemas'

// Cùng giới hạn với searchQuerySchema
const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 100

/** Như searchQuerySchema: trim, dài 2–100 (đếm trước khi gộp khoảng trắng), gộp khoảng trắng, chữ thường; sai → null */
export function normalizeSearchQuery(input: string): string | null {
  const trimmed = input.trim()
  // zod 4 đếm độ dài theo code point, không theo UTF-16 unit ('📚' dài 1)
  const length = [...trimmed].length
  if (length < MIN_QUERY_LENGTH || length > MAX_QUERY_LENGTH) return null
  return trimmed.replace(/\s+/g, ' ').toLowerCase()
}

const isRecord = (value: unknown): value is object =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseHit(value: unknown): SearchHit | null {
  if (!isRecord(value)) return null
  const id: unknown = Reflect.get(value, 'id')
  const slug: unknown = Reflect.get(value, 'slug')
  const title: unknown = Reflect.get(value, 'title')
  const coverUrl: unknown = Reflect.get(value, 'coverUrl')
  const authors: unknown = Reflect.get(value, 'authors')
  if (typeof id !== 'number' || !Number.isFinite(id)) return null
  if (typeof slug !== 'string' || typeof title !== 'string') return null
  if (coverUrl !== null && typeof coverUrl !== 'string') return null
  if (!Array.isArray(authors)) return null
  const entries: unknown[] = authors
  const names: string[] = []
  for (const name of entries) {
    if (typeof name !== 'string') return null
    names.push(name)
  }
  // Chỉ giữ các trường của hợp đồng (zod bỏ key thừa)
  return { id, slug, title, coverUrl, authors: names }
}

/** Như searchResponseSchema: `{ ok: true, data: SearchHit[] }` → danh sách gợi ý; sai một chỗ → null */
export function parseSearchResponse(value: unknown): SearchHit[] | null {
  if (!isRecord(value) || Reflect.get(value, 'ok') !== true) return null
  const data: unknown = Reflect.get(value, 'data')
  if (!Array.isArray(data)) return null
  const entries: unknown[] = data
  const hits: SearchHit[] = []
  for (const entry of entries) {
    const hit = parseHit(entry)
    if (!hit) return null
    hits.push(hit)
  }
  return hits
}
