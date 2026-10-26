import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PAGE_SIZE } from '../src/features/books/catalog-params'
import { WARNING_LIMITS } from '../src/features/chat/config'
import { slugify } from '../src/lib/slug'
import { readFixture } from './e2e-seed'
import { nameTokensKey } from './import-books'

// Dữ liệu sách của Supabase local e2e (scripts/e2e-seed.ts). Spec Playwright dựa vào các giả định dưới đây; sửa
// fixture làm hỏng giả định thì fail ở đây (job check) thay vì fail mơ hồ lúc chạy e2e.
const books = readFixture()
const FREE_SHIP_FROM = 300_000
const SHELF_SIZE = 12
/** Sách thật của used-market-public-account.spec: desktop-account, mobile-account */
const USED_MARKET_BOOKS = ['cha-me-5-0', 'nang-cao-von-tu-vung-tieng-nhat-theo-chu-de-bang-hinh-anh']
/** Dữ liệu của prefs-blocks-account.spec */
const PREFS_CATEGORY = 'truyen-ngan-tan-van'
const PREFS_BY_AUTHOR = 'muoi-chin-chan-dung-nha-van-cung-thoi'
const PREFS_BY_PUBLISHER = 'buoc-qua-nuoc-mat-tu-khac-truong-thanh'
const PREFS_FOREIGN_ROOT = 'sach-ngoai-van'
const PREFS_FOREIGN_CHILD = 'ngoai-van-thieu-nhi'
/** Dữ liệu thêm của prefs-book-account.spec */
const PREFS_SHORT = 'vong-buom'
const PREFS_CHILD_BOOK = 'how-not-to-be-a-twit-and-other-wisdom-from-roald-dahl'
/** Trần độ dài mô tả của sách đo CLS (khối Sở thích cuối cột thông tin gần màn hình đầu nhất) */
const PREFS_SHORT_MAX = 120
/** Sách của prefs-chat-account.spec (c): chặn tác giả của nó rồi hỏi Mây ở trang của nó */
const PREFS_CHAT_VIEWED = 'sapiens'
/** Dữ liệu của prefs-palette-account.spec: từ khóa gõ vào palette, cuốn bị chặn (theo tác giả), cuốn vẫn hiện */
const PALETTE_QUERY = 'van hoa'
const PALETTE_BLOCKED = 'tuyen-tap-van-hoc-viet-cho-thieu-nhi-to-hoai-1-truyen-dong-thoai-kich'
const PALETTE_VISIBLE = 'tu-dien-van-hoa-co-truyen-viet-nam'

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

  it('admin-warnings.spec (e): đủ sách mẫu cho lô gợi ý, không slug e2e-, không cụm [mock: trong tên', () => {
    // Sách mẫu có id nhỏ nhất (nạp trước mọi sách e2e): cuốn đầu + một lượt booksPerCall cuốn + ít nhất 1 cuốn còn lại
    // (lượt 1 phải còn sách → có nút Dừng). Cụm [mock:warn-…] trong tên sách điều khiển AI giả của cả lô.
    expect(books.length).toBeGreaterThanOrEqual(WARNING_LIMITS.booksPerCall + 2)
    for (const book of books) {
      expect(book.slug.startsWith('e2e-'), book.slug).toBe(false)
      expect(book.title, book.slug).not.toContain('[mock:')
    }
  })

  it('prefs-blocks-account.spec: danh mục một trang có đúng 2 sách bị chặn riêng (tác giả / NXB chỉ ở cuốn đó) + ≥ 2 sách không bị chặn; danh mục con của Sách ngoại văn có sách', () => {
    // Spec chặn tác giả đầu (vai trò author) của PREFS_BY_AUTHOR và NXB của PREFS_BY_PUBLISHER rồi đếm đúng 2 ô mờ trong
    // trang danh mục PREFS_CATEGORY (lưới một trang, ô mờ so kích thước với thẻ chưa chặn cùng hàng); chặn danh mục gốc
    // sach-ngoai-van rồi đếm ô mờ ở trang danh mục con PREFS_FOREIGN_CHILD + kệ "Sách ngoại văn" / "Mới về" ở trang chủ.
    const spec = read('../e2e/prefs-blocks-account.spec.ts')
    for (const slug of [PREFS_CATEGORY, PREFS_BY_AUTHOR, PREFS_BY_PUBLISHER, PREFS_FOREIGN_ROOT, PREFS_FOREIGN_CHILD]) {
      expect(spec, slug).toContain(`'${slug}'`)
    }
    const inCategory = books.filter((b) => b.category_slug === PREFS_CATEGORY)
    expect(inCategory.length).toBeGreaterThanOrEqual(4)
    expect(inCategory.length).toBeLessThanOrEqual(PAGE_SIZE)
    const byAuthor = inCategory.find((b) => b.slug === PREFS_BY_AUTHOR)
    const byPublisher = inCategory.find((b) => b.slug === PREFS_BY_PUBLISHER)
    expect(byAuthor, PREFS_BY_AUTHOR).toBeDefined()
    expect(byPublisher, PREFS_BY_PUBLISHER).toBeDefined()
    if (!byAuthor || !byPublisher) return
    // Một tác giả (spec chặn authorIds[0]), không cuốn nào khác của danh mục có tác giả / NXB bị chặn. So như import gộp
    // (ensureNamed): NXB theo slugify, tác giả theo tập từ của slug (reuseByNameTokens: "Nguyễn Huy Thiệp" = "Huy Thiệp
    // Nguyễn"). reuseByNameTokens chỉ gộp với dòng đã có trong DB (cùng lô trên DB mới vẫn 2 dòng) → so ở đây chặt hơn
    // DB: chỉ có thể đỏ thừa, không bỏ sót
    expect(byAuthor.authors).toHaveLength(1)
    const authorKey = (name: string) => nameTokensKey(slugify(name))
    const blockedAuthor = authorKey(byAuthor.authors[0] ?? '')
    const blockedPublisher = slugify(byPublisher.publisher ?? '')
    expect(blockedAuthor, `${PREFS_BY_AUTHOR}: thiếu tác giả`).toBeTruthy()
    expect(blockedPublisher, `${PREFS_BY_PUBLISHER}: thiếu NXB`).toBeTruthy()
    const blocked = inCategory.filter(
      (b) => b.authors.some((name) => authorKey(name) === blockedAuthor) || slugify(b.publisher ?? '') === blockedPublisher,
    )
    expect(blocked.map((b) => b.slug).sort()).toEqual([PREFS_BY_AUTHOR, PREFS_BY_PUBLISHER].sort())
    // Lưới 2 cột (mobile): ít nhất một thẻ bị chặn có thẻ chưa chặn cùng hàng. Mọi sách mẫu sold_count 0 → thứ tự theo
    // created_at (thứ tự nạp = thứ tự fixture, cùng lúc hoặc tăng dần) rồi id: xét cả thứ tự fixture lẫn đảo ngược
    const pairOf = (order: string[], slug: string) => Math.floor(order.indexOf(slug) / 2)
    for (const order of [inCategory.map((b) => b.slug), inCategory.map((b) => b.slug).reverse()]) {
      expect(pairOf(order, PREFS_BY_AUTHOR), order.join(', ')).not.toBe(pairOf(order, PREFS_BY_PUBLISHER))
    }
    // Danh mục lá của seed, đang bật, không thuộc Sách ngoại văn
    const categories = seedCategories(read('../supabase/seed.sql'))
    expect(categories.get(PREFS_CATEGORY)?.active).toBe(true)
    expect([...categories.values()].some((c) => c.parent === PREFS_CATEGORY)).toBe(false)

    const foreign = read('../supabase/seed-foreign-books.sql')
    expect(foreign).toContain(`join public.categories p on p.slug = '${PREFS_FOREIGN_ROOT}'`)
    expect(foreign).toContain(`'${PREFS_FOREIGN_CHILD}'`)
    const inChild = books.filter((b) => b.category_slug === PREFS_FOREIGN_CHILD)
    expect(inChild.length).toBeGreaterThan(0)
    expect(inChild.length).toBeLessThanOrEqual(PAGE_SIZE)
    // Kệ "Mới về" (chỉ sách tiếng Việt) không có sách nào của nhánh Sách ngoại văn: spec đếm 0 ô mờ ở kệ đó
    // Slug là cột thứ 3 của mỗi dòng values (tên có thể chứa '' của SQL: Children''s Books)
    const sqlText = String.raw`'(?:[^']|'')*'`
    const foreignChildren = [...foreign.matchAll(new RegExp(String.raw`^\s*\(${sqlText},\s*${sqlText},\s*'([^']+)',`, 'gm'))].map(
      (match) => match[1],
    )
    expect(foreignChildren).toContain(PREFS_FOREIGN_CHILD)
    expect(books.filter((b) => b.language === 'vi' && foreignChildren.includes(b.category_slug)).map((b) => b.slug)).toEqual([])
  })

  it('prefs-book-account.spec: sách đo CLS có mô tả ngắn nhất (trong sách có danh mục + tác giả + NXB), sách ở danh mục con của Sách ngoại văn có tác giả + NXB', () => {
    // (h) đo CLS ở trang PREFS_SHORT (trường hợp xấu nhất: mô tả ngắn → khối Sở thích cuối cột gần màn hình đầu nhất) và
    // chặn tác giả đầu của nó; (f) / (g) bấm "Không muốn thấy tác giả" ở cùng trang; (d) chặn PREFS_FOREIGN_ROOT rồi mở
    // trang PREFS_CHILD_BOOK: dòng nhắc nêu tên danh mục gốc + menu còn nút tác giả. (b) dùng PREFS_BY_AUTHOR trong
    // PREFS_CATEGORY (bất biến ở test prefs-blocks-account bên trên: tác giả chỉ có ở cuốn đó trong danh mục).
    const spec = read('../e2e/prefs-book-account.spec.ts')
    for (const slug of [PREFS_CATEGORY, PREFS_BY_AUTHOR, PREFS_BY_PUBLISHER, PREFS_SHORT, PREFS_FOREIGN_ROOT, PREFS_CHILD_BOOK]) {
      expect(spec, slug).toContain(`'${slug}'`)
    }
    const complete = books.filter((b) => b.authors.length > 0 && b.publisher && b.category_slug)
    const short = complete.find((b) => b.slug === PREFS_SHORT)
    expect(short, PREFS_SHORT).toBeDefined()
    if (!short) return
    expect(short.category_slug).toBe(PREFS_CATEGORY)
    const length = (short.description ?? '').length
    expect(length).toBeLessThanOrEqual(PREFS_SHORT_MAX)
    expect(Math.min(...complete.map((b) => (b.description ?? '').length))).toBe(length)

    const child = complete.find((b) => b.slug === PREFS_CHILD_BOOK)
    expect(child, PREFS_CHILD_BOOK).toBeDefined()
    expect(child?.category_slug).toBe(PREFS_FOREIGN_CHILD)
  })

  it('prefs-chat-account.spec: sách xem ở (c) có tác giả, còn hàng; chặn 1 danh mục + tác giả của 2 cuốn vẫn còn sách gợi ý được', () => {
    // (a)(b): B hỏi Mây → ≤ 3 thẻ; A chặn danh mục của thẻ đầu + mọi tác giả của tối đa 2 thẻ còn lại rồi hỏi lại → vẫn
    // phải có thẻ (AI giả trả slug đầu của ứng viên) → mọi sách mẫu còn hàng có danh mục + tác giả, và trừ danh mục đông
    // nhất + số sách chung tác giả với 2 cuốn bất kỳ (xét mọi cặp, sách nhiều tác giả tính đủ) vẫn còn sách. (c): chặn
    // tác giả của PREFS_CHAT_VIEWED rồi hỏi ở trang của nó → còn sách không cùng tác giả. Tác giả so như import gộp
    // (nameTokensKey).
    const spec = read('../e2e/prefs-chat-account.spec.ts')
    expect(spec).toContain(`'${PREFS_CHAT_VIEWED}'`)
    expect(spec).toContain('[mock:5-books]')
    const inStock = books.filter((b) => b.stock > 0)
    for (const book of inStock) {
      expect(book.category_slug, book.slug).toBeTruthy()
      expect(book.authors.length, book.slug).toBeGreaterThan(0)
    }
    const counts = new Map<string, number>()
    for (const book of inStock) counts.set(book.category_slug, (counts.get(book.category_slug) ?? 0) + 1)
    const perCategory = Math.max(...counts.values())
    const authorKey = (name: string) => nameTokensKey(slugify(name))
    const authorsOf = (book: (typeof inStock)[number]) => book.authors.map(authorKey)
    let byTwoAuthors = 0
    for (const a of inStock) {
      for (const b of inStock) {
        const blocked = new Set([...authorsOf(a), ...authorsOf(b)])
        byTwoAuthors = Math.max(byTwoAuthors, inStock.filter((book) => authorsOf(book).some((key) => blocked.has(key))).length)
      }
    }
    expect(inStock.length - perCategory - byTwoAuthors).toBeGreaterThanOrEqual(3)

    const viewed = inStock.find((b) => b.slug === PREFS_CHAT_VIEWED)
    expect(viewed, PREFS_CHAT_VIEWED).toBeDefined()
    const viewedAuthors = (viewed?.authors ?? []).map(authorKey)
    expect(inStock.filter((b) => !b.authors.some((name) => viewedAuthors.includes(authorKey(name)))).length).toBeGreaterThanOrEqual(3)
  })

  it('prefs-palette-account.spec: từ khóa khớp 2–8 sách mẫu ở danh mục đang hiện, có cuốn bị chặn (tác giả riêng) lẫn cuốn không; không khớp sách / tác giả e2e', () => {
    // Spec gõ PALETTE_QUERY vào palette (search_books: mọi từ là chuỗi con của search_text = tên + phụ đề + ISBN + tên tác
    // giả, bỏ dấu, chữ thường), chặn tác giả đầu của PALETTE_BLOCKED rồi đợi đúng dòng đó bị che, PALETTE_VISIBLE vẫn hiện
    // tên. Mọi kết quả phải vào palette (≤ SEARCH_HIT_LIMIT của searchBookHits) và thuộc danh mục đang hiện (palette bỏ
    // sách của danh mục ẩn). So bỏ dấu như normalize_vi (unaccent): chỉ có thể lệch ở ký tự lạ (ligature…), không có ở đây.
    const spec = read('../e2e/prefs-palette-account.spec.ts')
    for (const value of [PALETTE_QUERY, PALETTE_BLOCKED, PALETTE_VISIBLE]) expect(spec, value).toContain(`'${value}'`)
    const limit = Number(/const SEARCH_HIT_LIMIT = (\d+)/.exec(read('../src/features/books/queries.ts'))?.[1])
    expect(limit).toBeGreaterThan(0)

    const normalize = (text: string) =>
      text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
    const terms = normalize(PALETTE_QUERY).split(/\s+/)
    const searchText = (b: (typeof books)[number]) => normalize([b.title, b.subtitle, b.isbn, ...b.authors].filter(Boolean).join(' '))
    const matches = books.filter((b) => terms.every((term) => searchText(b).includes(term)))
    expect(matches.length).toBeGreaterThanOrEqual(2)
    expect(matches.length).toBeLessThanOrEqual(limit)

    const categories = seedCategories(read('../supabase/seed.sql'))
    for (const book of matches) {
      const category = categories.get(book.category_slug)
      expect(category?.active, `${book.slug}: ${book.category_slug} không có trong seed.sql / đang tắt`).toBe(true)
      if (category?.parent) expect(categories.get(category.parent)?.active, `${book.slug}: danh mục cha`).toBe(true)
    }

    const blocked = matches.find((b) => b.slug === PALETTE_BLOCKED)
    const visible = matches.find((b) => b.slug === PALETTE_VISIBLE)
    expect(blocked, PALETTE_BLOCKED).toBeDefined()
    expect(visible, PALETTE_VISIBLE).toBeDefined()
    if (!blocked) return
    // Một tác giả (spec chặn authors[0]); không kết quả nào khác của từ khóa có tác giả đó (so như import gộp)
    expect(blocked.authors).toHaveLength(1)
    const authorKey = (name: string) => nameTokensKey(slugify(name))
    const blockedAuthor = authorKey(blocked.authors[0] ?? '')
    expect(blockedAuthor).toBeTruthy()
    expect(matches.filter((b) => b.authors.some((name) => authorKey(name) === blockedAuthor)).map((b) => b.slug)).toEqual([
      PALETTE_BLOCKED,
    ])

    // Sách / tác giả e2e tạo song song (tên "E2E sách <hex>", "E2E tác giả <hex>"…, slug ngẫu nhiên hex) không khớp từ
    // khóa: mỗi từ có chữ ngoài hex và không phải chuỗi con của tên mẫu nào trong scripts/e2e-user.ts
    for (const term of terms) expect(term, term).toMatch(/[^0-9a-f]/)
    const templates = [...read('./e2e-user.ts').matchAll(/(?:title|name): (?:titleTag \? )?`([^`]*)`/g)].map((match) =>
      normalize((match[1] ?? '').replace(/\$\{[^}]*\}/g, ' ')),
    )
    expect(templates.length).toBeGreaterThan(0)
    for (const template of templates) expect(terms.every((term) => template.includes(term)), template).toBe(false)
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
