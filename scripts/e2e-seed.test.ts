import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PAGE_SIZE } from '../src/features/books/catalog-params'
import { readFixture } from './e2e-seed'

// Dữ liệu sách của Supabase local e2e (scripts/e2e-seed.ts). Spec Playwright dựa vào các giả định dưới đây; sửa
// fixture làm hỏng giả định thì fail ở đây (job check) thay vì fail mơ hồ lúc chạy e2e.
const books = readFixture()
const FREE_SHIP_FROM = 300_000
const SHELF_SIZE = 12

describe('e2e/fixtures/books.json', () => {
  it('ISBN, slug không trùng', () => {
    expect(new Set(books.map((b) => b.isbn)).size).toBe(books.length)
    expect(new Set(books.map((b) => b.slug)).size).toBe(books.length)
  })

  it('lưới / tìm kiếm "978" có trang 2 (catalog, home, layout)', () => {
    expect(books.filter((b) => b.isbn.startsWith('978')).length).toBeGreaterThan(PAGE_SIZE)
  })

  it('có /sach/sapiens (seo.spec)', () => {
    expect(books.find((b) => b.slug === 'sapiens')?.title).toMatch(/^Sapiens/)
  })

  it('chat.spec: sapiens còn hàng (thêm vào giỏ), có mô tả ≥ 40 ký tự (kiểm mô tả không đi lên từ client)', () => {
    const sapiens = books.find((b) => b.slug === 'sapiens')
    expect(sapiens?.stock).toBeGreaterThan(0)
    expect(sapiens?.description?.length ?? 0).toBeGreaterThanOrEqual(40)
  })

  it('chat.spec: câu tâm trạng có sách tiếng Việt còn hàng ở nhóm kỹ năng / tâm lý và văn học Việt (≥ 3 thẻ)', () => {
    const inStock = (slugs: string[]) => books.filter((b) => b.stock > 0 && b.language === 'vi' && slugs.includes(b.category_slug))
    expect(inStock(['ky-nang-song', 'tam-ly-hoc']).length).toBeGreaterThanOrEqual(1)
    expect(inStock(['truyen-ngan-tan-van', 'tieu-thuyet', 'tho']).length).toBeGreaterThanOrEqual(3)
  })

  it('kệ "Mới về" (sách tiếng Việt) tràn kệ, có sách tiếng Anh cho kệ / bộ lọc ngoại văn (home.spec)', () => {
    expect(books.filter((b) => b.language === 'vi').length).toBeGreaterThan(SHELF_SIZE)
    expect(books.filter((b) => b.language === 'en').length).toBeGreaterThan(0)
  })

  it('lọc tiếng Anh có trang 2 (crawl.spec, measure.ts: /sach?lang=en&sort=price-asc&page=2)', () => {
    expect(books.filter((b) => b.language === 'en').length).toBeGreaterThan(PAGE_SIZE)
  })

  it('Văn học có ≥ 2 danh mục con có sách, danh mục con đầu (Tiểu thuyết) có sách (catalog.spec)', () => {
    const children = new Set(books.map((b) => b.category_slug).filter((slug) => ['tieu-thuyet', 'truyen-ngan-tan-van', 'tho'].includes(slug)))
    expect(children.size).toBeGreaterThanOrEqual(2)
    expect(children.has('tieu-thuyet')).toBe(true)
  })

  it('mọi danh mục con của Sách ngoại văn có sách', () => {
    const foreign = ['ngoai-van-van-hoc', 'ngoai-van-kinh-doanh', 'ngoai-van-ky-nang-song', 'ngoai-van-thieu-nhi', 'ngoai-van-lich-su-khoa-hoc']
    for (const slug of foreign) expect(books.some((b) => b.category_slug === slug), slug).toBe(true)
  })

  it('có tác giả, có mô tả (trang sách, link tác giả)', () => {
    expect(books.filter((b) => b.authors.length > 0 && b.description).length).toBeGreaterThan(PAGE_SIZE)
  })

  it('đủ nhóm tồn kho của cart / cart-account spec', () => {
    expect(books.some((b) => b.stock === 0)).toBe(true)
    expect(books.some((b) => b.stock >= 1 && b.stock <= 5)).toBe(true)
    // findBooksByStock(10, 10_000, 20) lấy 20 cuốn đầu theo id (= thứ tự trong fixture): tăng số lượng tới mốc
    // freeship mà không vượt tồn kho
    const roomy = books.filter((b) => b.stock >= 10).slice(0, 20)
    expect(roomy.length).toBe(20)
    expect(roomy.some((b) => b.price < FREE_SHIP_FROM && Math.ceil(FREE_SHIP_FROM / b.price) <= Math.min(b.stock, 99))).toBe(true)
  })

  it('có giá 100.000 – 200.000 ₫ (lọc giá)', () => {
    expect(books.some((b) => b.price >= 100_000 && b.price <= 200_000)).toBe(true)
  })

  it('mô tả ≤ 300 ký tự (repo public)', () => {
    for (const book of books) expect((book.description ?? '').length, book.slug).toBeLessThanOrEqual(301)
  })
})

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('seed của Supabase local (ux-messages)', () => {
  it('seed.sql có ít nhất 1 voucher public (gợi ý mã ở checkout.spec có mã seed hiện chung)', () => {
    const insert = /insert into public\.vouchers \(([^)]*)\) values([\s\S]*?);/.exec(read('../supabase/seed.sql'))
    expect(insert, 'seed.sql không có insert into public.vouchers').not.toBeNull()
    const columns = (insert?.[1] ?? '').split(',').map((column) => column.trim())
    expect(columns.at(-1)).toBe('is_public')
    const rows = (insert?.[2] ?? '').split('\n').filter((line) => line.trim().startsWith('('))
    expect(rows.filter((row) => /,\s*true\)[,;]?\s*$/.test(row)).length).toBeGreaterThanOrEqual(1)
  })

  it('kệ "Bán chạy" ẩn với dữ liệu seed: không đường nạp nào ghi sold_count (mặc định 0, chỉ đơn hàng mới tăng)', () => {
    // Kệ cần sold_count > 0 ở ≥ 6 sách (SHELF_MIN, features/books/queries.ts). Không spec nào dựa vào kệ này hiện;
    // sách e2e có đơn nằm trong danh mục ẩn nên cũng không lên kệ (visibleCategoryIds, ux-messages mục 15).
    const loaders = ['./import-books.ts', './e2e-seed.ts', '../supabase/seed.sql', '../supabase/seed-foreign-books.sql', '../e2e/fixtures/books.json']
    for (const path of loaders) expect(read(path), path).not.toContain('sold_count')
    expect(read('../supabase/schema.sql')).toMatch(/sold_count\s+int not null default 0/)
  })
})
