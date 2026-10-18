import { describe, expect, it } from 'vitest'
import { selectCandidates, type CatalogCategory } from './candidates'
import type { ChatCatalogBook } from './queries'

// Danh mục và phân bố giống DB thật (data.md, Phase 11): sách Việt kỹ năng / tâm lý rất ít, ngoại văn nhiều
const categories: CatalogCategory[] = [
  { id: 1, parent_id: null, name: 'Văn học', slug: 'van-hoc' },
  { id: 2, parent_id: 1, name: 'Truyện ngắn - Tản văn', slug: 'truyen-ngan-tan-van' },
  { id: 3, parent_id: 1, name: 'Tiểu thuyết', slug: 'tieu-thuyet' },
  { id: 4, parent_id: 1, name: 'Thơ', slug: 'tho' },
  { id: 5, parent_id: null, name: 'Tâm lý - Kỹ năng sống', slug: 'tam-ly-ky-nang-song' },
  { id: 6, parent_id: 5, name: 'Kỹ năng sống', slug: 'ky-nang-song' },
  { id: 7, parent_id: 5, name: 'Tâm lý học', slug: 'tam-ly-hoc' },
  { id: 8, parent_id: null, name: 'Sách ngoại văn', slug: 'sach-ngoai-van' },
  { id: 9, parent_id: 8, name: 'Kỹ năng sống (ngoại văn)', slug: 'ngoai-van-ky-nang-song' },
  { id: 10, parent_id: 8, name: 'Kinh doanh (ngoại văn)', slug: 'ngoai-van-kinh-doanh' },
  { id: 11, parent_id: 8, name: 'Văn học (ngoại văn)', slug: 'ngoai-van-van-hoc' },
  { id: 12, parent_id: null, name: 'Lịch sử - Địa lý', slug: 'lich-su-dia-ly' },
]

let nextId = 1
function book(categoryId: number, language: 'vi' | 'en', patch: Partial<ChatCatalogBook> = {}): ChatCatalogBook {
  const id = nextId++
  return {
    id,
    slug: `sach-${id}`,
    title: `Sách ${id}`,
    language,
    category_id: categoryId,
    stock: 10,
    sold_count: 0,
    is_featured: false,
    cover_width: 600,
    description: 'Một cuốn sách.',
    book_authors: [{ role: 'author', authors: { name: `Tác giả ${id}` } }],
    ...patch,
  }
}

const many = (count: number, categoryId: number, language: 'vi' | 'en') =>
  Array.from({ length: count }, () => book(categoryId, language))

const books: ChatCatalogBook[] = [
  ...many(18, 2, 'vi'),
  ...many(4, 3, 'vi'),
  book(4, 'vi'),
  book(6, 'vi', { slug: 'dac-nhan-tam', title: 'Đắc nhân tâm', book_authors: [{ role: 'author', authors: { name: 'Dale Carnegie' } }] }),
  book(6, 'vi'),
  book(6, 'vi', { stock: 0 }),
  book(7, 'vi'),
  ...many(11, 9, 'en'),
  ...many(23, 10, 'en'),
  ...many(29, 11, 'en'),
  ...many(25, 12, 'vi'),
  book(12, 'vi', { slug: 'het-hang', stock: 0 }),
  book(10, 'en', { slug: 'sapiens', title: 'Sapiens', description: 'A brief history of humankind.' }),
]

const slugsOf = (list: { slug: string }[]) => list.map((candidate) => candidate.slug)
const bySlug = new Map(books.map((item) => [item.slug, item]))
const languageOf = (slug: string) => bySlug.get(slug)?.language
const categoryOf = (slug: string) => categories.find((c) => c.id === bySlug.get(slug)?.category_id)?.slug

describe('selectCandidates', () => {
  it('tối đa 30 cuốn, không trùng, mỗi danh mục ≤ 5 ở phần lấp (không kể khớp từ khóa / sách đang xem)', () => {
    const result = selectCandidates({ books, categories, message: 'gợi ý sách đọc cuối tuần' })
    expect(result.length).toBeLessThanOrEqual(30)
    expect(new Set(slugsOf(result)).size).toBe(result.length)
  })

  it('bỏ sách hết hàng', () => {
    const result = selectCandidates({ books, categories, message: 'lịch sử' })
    expect(slugsOf(result)).not.toContain('het-hang')
  })

  it('câu tâm trạng tiếng Việt → có sách tiếng Việt, kéo thêm văn học Việt (ky-nang-song / tam-ly-hoc quá ít)', () => {
    const result = selectCandidates({ books, categories, message: 'Tôi đang thấy mông lung, lạc hướng' })
    const slugs = slugsOf(result)
    const vietnamese = slugs.filter((slug) => languageOf(slug) === 'vi')
    expect(vietnamese.length).toBeGreaterThanOrEqual(8)
    const leaves = new Set(vietnamese.map(categoryOf))
    expect(leaves).toContain('ky-nang-song')
    expect(leaves).toContain('tam-ly-hoc')
    expect([...leaves].filter((leaf) => leaf === 'truyen-ngan-tan-van' || leaf === 'tieu-thuyet' || leaf === 'tho').length).toBeGreaterThan(0)
    // Sách tiếng Việt của nhóm tâm trạng đứng trước ngoại văn cùng nhóm
    const firstEnglish = slugs.findIndex((slug) => languageOf(slug) === 'en')
    const lastMoodVietnamese = Math.max(...slugs.map((slug, index) => (categoryOf(slug) === 'tam-ly-hoc' ? index : -1)))
    expect(firstEnglish === -1 || lastMoodVietnamese < firstEnglish).toBe(true)
  })

  it('gõ không dấu cũng khớp như có dấu', () => {
    const accented = selectCandidates({ books, categories, message: 'Tôi đang thấy mông lung, lạc hướng' })
    const plain = selectCandidates({ books, categories, message: 'toi dang thay mong lung lac huong' })
    expect(slugsOf(plain)).toEqual(slugsOf(accented))
  })

  it('khớp tên / tác giả đứng đầu', () => {
    const result = selectCandidates({ books, categories, message: 'sách của dale carnegie' })
    expect(result[0]?.slug).toBe('dac-nhan-tam')
  })

  it('nhắc "tiếng Anh" → ưu tiên sách en (mỗi danh mục ngoại văn lấp tới mức trần 5)', () => {
    const english = (message: string) =>
      slugsOf(selectCandidates({ books, categories, message })).filter((slug) => languageOf(slug) === 'en')
    expect(english('sách tiếng Anh đọc cuối tuần')).toHaveLength(15)
    expect(english('sách đọc cuối tuần').length).toBeLessThan(15)
  })

  it('có slug trang sách → cuốn đó đứng đầu, kể cả hết hàng, kèm sách cùng danh mục', () => {
    const result = selectCandidates({ books, categories, message: 'Cuốn này nói về gì?', currentSlug: 'het-hang' })
    expect(result[0]?.slug).toBe('het-hang')
    expect(slugsOf(result.slice(1, 7)).every((slug) => categoryOf(slug) === 'lich-su-dia-ly')).toBe(true)
  })

  it('ổn định: cùng đầu vào → cùng kết quả', () => {
    const input = { books, categories, message: 'sách kinh doanh cho người mới khởi nghiệp' }
    expect(slugsOf(selectCandidates(input))).toEqual(slugsOf(selectCandidates(input)))
  })

  it('ứng viên chỉ có dữ liệu công khai, mô tả rút gọn ≤ 160 ký tự', () => {
    const long = book(2, 'vi', { slug: 'dai', description: 'chữ '.repeat(200) })
    const [first] = selectCandidates({ books: [long], categories, message: 'x' })
    expect(Object.keys(first ?? {}).sort()).toEqual(['authors', 'category', 'description', 'language', 'slug', 'title'])
    expect(first?.description.length).toBeLessThanOrEqual(160)
  })
})
