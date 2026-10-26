// Hàm thuần cho palette tìm kiếm, chạy ở client. KHÔNG import zod: zod vào chunk palette tốn ~30KB gzip (CLAUDE.md →
// Hiệu năng). Server (/api/search, catalogParamsSchema) vẫn parse từ khóa bằng searchQuerySchema (schemas.ts);
// searchResponseSchema là hợp đồng JSON của /api/search (nguồn kiểu SearchHit). search-input.test.ts kiểm hàm tay và hai
// schema zod cho cùng kết quả trên cùng bộ input.
import { keysBlocked, type ExpandedBlocks } from '@/features/prefs/blocks'
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

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Mảng mà mọi phần tử qua `check` (như z.array); sai một phần tử → null */
function arrayOf<T>(value: unknown, check: (item: unknown) => item is T): T[] | null {
  if (!Array.isArray(value)) return null
  const entries: unknown[] = value
  const items: T[] = []
  for (const item of entries) {
    if (!check(item)) return null
    items.push(item)
  }
  return items
}

const isString = (value: unknown): value is string => typeof value === 'string'

type HitBlockKeys = NonNullable<SearchHit['blockKeys']>

/** Như blockKeys của searchHitSchema; sai kiểu → null (cả hit bị loại, như zod) */
function parseBlockKeys(value: unknown): HitBlockKeys | null {
  if (!isRecord(value)) return null
  const categoryId: unknown = Reflect.get(value, 'categoryId')
  const publisherId: unknown = Reflect.get(value, 'publisherId')
  if (categoryId !== null && !isNumber(categoryId)) return null
  if (publisherId !== null && !isNumber(publisherId)) return null
  const authorIds = arrayOf(Reflect.get(value, 'authorIds'), isNumber)
  const warnings = arrayOf(Reflect.get(value, 'warnings'), isString)
  if (!authorIds || !warnings) return null
  return { categoryId, publisherId, authorIds, warnings }
}

function parseHit(value: unknown): SearchHit | null {
  if (!isRecord(value)) return null
  const id: unknown = Reflect.get(value, 'id')
  const slug: unknown = Reflect.get(value, 'slug')
  const title: unknown = Reflect.get(value, 'title')
  const coverUrl: unknown = Reflect.get(value, 'coverUrl')
  if (!isNumber(id)) return null
  if (typeof slug !== 'string' || typeof title !== 'string') return null
  if (coverUrl !== null && typeof coverUrl !== 'string') return null
  const authors = arrayOf(Reflect.get(value, 'authors'), isString)
  if (!authors) return null
  // Chỉ giữ các trường của hợp đồng (zod bỏ key thừa)
  const hit: SearchHit = { id, slug, title, coverUrl, authors }
  // blockKeys không bắt buộc: phản hồi cũ trong CDN (trước khi có trường này) vẫn hợp lệ, dòng đó không bị che
  const rawKeys: unknown = Reflect.get(value, 'blockKeys')
  if (rawKeys === undefined) return hit
  const blockKeys = parseBlockKeys(rawKeys)
  return blockKeys ? { ...hit, blockKeys } : null
}

/** Trạng thái một dòng sách của palette: che khi khóa của sách trúng mục chặn và người xem chưa bấm "Xem" dòng đó */
export function paletteRow(
  hit: SearchHit,
  blocks: ExpandedBlocks | null,
  revealed: ReadonlySet<number>,
): 'veiled' | 'visible' {
  if (!hit.blockKeys || !blocks || revealed.has(hit.id)) return 'visible'
  return keysBlocked(hit.blockKeys, blocks) ? 'veiled' : 'visible'
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
