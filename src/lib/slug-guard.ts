import type { SlugPathname } from '@/i18n/paths'

/** Danh sách slug công khai của một loại trang; `one` kiểm tra đúng một slug (luôn mới) */
export type SlugLoader = {
  all: (kind: SlugPathname) => Promise<string[]>
  one: (kind: SlugPathname, slug: string) => Promise<boolean>
}

const TTL_MS = 60_000

/**
 * Slug có tồn tại không, cho proxy trả HTTP 404 thật (Cache Components stream trang trước khi notFound() chạy nên
 * trang tự nó chỉ trả 200). Danh sách slug cache trong bộ nhớ 60 giây → trang thật không tốn query mỗi request.
 * Không có trong danh sách (slug lạ, hoặc sách / danh mục vừa tạo / đổi slug) → hỏi thẳng một slug, luôn mới.
 * Lỗi mạng → coi như có (giữ hành vi cũ: trang tự hiện UI 404 + noindex), không chặn nhầm trang thật.
 */
export function createSlugGuard(loader: SlugLoader, now: () => number = Date.now) {
  const cache = new Map<SlugPathname, { slugs: Set<string>; at: number }>()

  async function list(kind: SlugPathname) {
    const entry = cache.get(kind)
    if (entry && now() - entry.at < TTL_MS) return entry.slugs
    const slugs = new Set(await loader.all(kind))
    cache.set(kind, { slugs, at: now() })
    return slugs
  }

  return async function exists(kind: SlugPathname, slug: string): Promise<boolean> {
    try {
      if ((await list(kind)).has(slug)) return true
      return await loader.one(kind, slug)
    } catch (error) {
      console.error('slug-guard:', error instanceof Error ? error.message : error)
      return true
    }
  }
}
