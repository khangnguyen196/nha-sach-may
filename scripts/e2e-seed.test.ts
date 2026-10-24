import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PAGE_SIZE } from '../src/features/books/catalog-params'
import { readFixture } from './e2e-seed'

// Dữ liệu sách của Supabase local e2e (scripts/e2e-seed.ts). Spec Playwright dựa vào các giả định dưới đây; sửa
// fixture làm hỏng giả định thì fail ở đây (job check) thay vì fail mơ hồ lúc chạy e2e.
const books = readFixture()
const FREE_SHIP_FROM = 300_000
const SHELF_SIZE = 12
/** Sách thật của used-market-public-account.spec: desktop-account, mobile-account */
const USED_MARKET_BOOKS = ['cha-me-5-0', 'nang-cao-von-tu-vung-tieng-nhat-theo-chu-de-bang-hinh-anh']

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

  it('có sách tồn ≥ 20 (prehydrate.spec, login-typing.spec: thêm vào giỏ trên sách thật)', () => {
    expect(books.some((b) => b.stock >= 20)).toBe(true)
  })

  it('có giá 100.000 – 200.000 ₫ (lọc giá)', () => {
    expect(books.some((b) => b.price >= 100_000 && b.price <= 200_000)).toBe(true)
  })

  it('used-market-public-account.spec: mỗi project một sách thật cho chợ sách cũ (danh mục lá đang bật, giá gốc > giá tin)', () => {
    // Sách riêng của spec (desktop / mobile chạy song song, đếm "Có N bản cũ" trên đúng cuốn của mình): danh mục LÁ của
    // seed (không có danh mục con) và đang bật, cả cha (danh sách chợ chỉ hiện sách của danh mục đang hiện); có giá gốc
    // lớn hơn mọi giá tin của spec trên sách này (lời gọi createPendingListing không truyền sách khác); còn hàng, không
    // nằm trong 20 cuốn đầu findBooksByStock(10, …) của cart spec, không spec nào khác nhắc tới slug
    const roomy = books.filter((b) => b.stock >= 10).slice(0, 20)
    const categories = seedCategories(read('../supabase/seed.sql'))
    const spec = read('../e2e/used-market-public-account.spec.ts')
    // Mọi lời gọi trên sách của project (một tham số) phải viết thẳng giá; lời gọi có tham số sách (sách e2e) bỏ qua
    const calls = [...spec.matchAll(/(?<!function )createPendingListing\(([^)]*)\)/g)].map((match) => match[1] ?? '')
    const ownBook = calls.filter((args) => !args.includes(','))
    for (const args of ownBook) expect(args, 'giá tin phải viết thẳng (VD 25_000)').toMatch(/^\d[\d_]*$/)
    const listingPrices = ownBook.map((args) => Number(args.replaceAll('_', '')))
    expect(listingPrices.length).toBeGreaterThan(0)
    const maxListingPrice = Math.max(...listingPrices)
    const others = readdirSync(new URL('../e2e/', import.meta.url))
      .filter((file) => file.endsWith('.ts') && file !== 'used-market-public-account.spec.ts')
      .map((file) => read(`../e2e/${file}`))
      .join(' ')
    for (const slug of USED_MARKET_BOOKS) {
      const book = books.find((b) => b.slug === slug)
      expect(book, slug).toBeDefined()
      if (!book) continue
      expect(book.original_price, slug).not.toBeNull()
      expect(book.original_price ?? 0, slug).toBeGreaterThan(maxListingPrice)
      expect(book.stock, slug).toBeGreaterThan(5)
      expect(roomy.map((b) => b.slug), slug).not.toContain(slug)
      const category = categories.get(book.category_slug)
      expect(category, `${slug}: danh mục ${book.category_slug} không có trong seed.sql`).toBeDefined()
      if (!category) continue
      expect(category.active, `${slug}: ${book.category_slug} đang tắt`).toBe(true)
      if (category.parent) {
        const parent = categories.get(category.parent)
        expect(parent?.active, `${slug}: danh mục cha ${category.parent} không có / đang tắt`).toBe(true)
      }
      const children = [...categories.values()].filter((c) => c.parent === book.category_slug)
      expect(children, `${slug}: ${book.category_slug} có danh mục con`).toEqual([])
      expect(others, slug).not.toContain(slug)
    }
    expect(spec).toContain(`'${USED_MARKET_BOOKS[0]}'`)
  })

  it('mô tả ≤ 300 ký tự (repo public)', () => {
    for (const book of books) expect((book.description ?? '').length, book.slug).toBeLessThanOrEqual(301)
  })
})

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

type SeedCategory = { parent: string | null; active: boolean }

/**
 * Mặc định is_active của RIÊNG bảng categories (schema.sql còn bảng khác có cùng dòng cột): tìm trong khối `create table
 * public.categories (…);`, không thấy khối thì coi là tắt (test đỏ), và không có câu alter đổi default về sau.
 */
function categoriesDefaultActive() {
  const schema = read('../supabase/schema.sql')
  const table = /create table public\.categories \(([\s\S]*?)\r?\n\);/.exec(schema)?.[1]
  if (table === undefined || !/is_active\s+boolean not null default true/.test(table)) return false
  return !/alter\s+table\s+(if\s+exists\s+)?(only\s+)?(public\.)?categories\s+alter\s+(column\s+)?is_active\s+(set|drop)\s+default/i.test(schema)
}

/** Seed nào (seed.sql + seed-foreign-books.sql, DB local nạp cả hai) có câu update danh mục, có hay không tiền tố schema */
const seedUpdatesCategories = (sql: string) =>
  [sql, read('../supabase/seed-foreign-books.sql')].some((seed) => /update\s+(public\.)?categories/i.test(seed))

/**
 * Danh mục của seed.sql theo slug: khối danh mục cha `(tên, tên en, slug, thứ tự)` và khối danh mục con `(cha, tên, tên
 * en, slug, thứ tự)`; khối nào thêm cột (VD is_active) thì regex không khớp → không có danh mục nào (test đỏ). Không ghi
 * is_active → lấy mặc định của schema.sql; seed có câu update danh mục thì coi mọi danh mục là tắt (không tự đoán câu
 * update đổi danh mục nào).
 */
function seedCategories(sql: string) {
  const active = categoriesDefaultActive() && !seedUpdatesCategories(sql)
  const quoted = (line: string) => [...line.matchAll(/'([^']*)'/g)].map((match) => match[1] ?? '')
  const rows = (block: string | undefined) => (block ?? '').split('\n').filter((line) => line.trim().startsWith('('))

  const roots = /insert into public\.categories \(name, name_en, slug, sort_order\) values([\s\S]*?);/.exec(sql)?.[1]
  const children = /from \(values([\s\S]*?)\) as c\(parent_slug, name, name_en, slug, sort_order\)/.exec(sql)?.[1]
  const categories = new Map<string, SeedCategory>()
  for (const line of rows(roots)) {
    const [, , slug] = quoted(line)
    if (slug) categories.set(slug, { parent: null, active })
  }
  for (const line of rows(children)) {
    const [parent, , , slug] = quoted(line)
    if (parent && slug) categories.set(slug, { parent, active })
  }
  return categories
}

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
