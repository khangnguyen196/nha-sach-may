import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { CATEGORY_SHELF_MIN, CATEGORY_SHELF_SIZE } from '../src/features/books/utils'
import { collectErrors, waitForSettled } from './helpers'

// Kệ danh mục trang chủ (đợt ke-danh-muc): mỗi danh mục cha đang hiện (trừ Sách ngoại văn, có kệ riêng) một kệ ≤ 12
// cuốn, ẩn khi < 4; dưới tiêu đề là hàng chip danh mục con; kệ Sách ngoại văn cũng có chip. Kỳ vọng suy từ seed
// (supabase/seed.sql, seed-foreign-books.sql) + e2e/fixtures/books.json; bất biến dữ liệu ở scripts/e2e-seed.test.ts.
// Không tạo dữ liệu, không cần user. Bất biến: sách e2e (createE2eBook / createShopBooks) luôn nằm dưới danh mục gốc
// ẩn hoặc không có danh mục, không vào danh mục thật đang hiện → số sách trong kệ chỉ đến từ fixture.

const FOREIGN_ROOT = 'sach-ngoai-van'

type SeedCategory = { slug: string; name: string; nameEn: string; parent: string | null; sortOrder: number }

// Playwright biên dịch spec sang CommonJS (không có import.meta): đọc file theo đường dẫn từ gốc repo
const read = (path: string) => readFileSync(path, 'utf8')
const fixture: { category_slug: string }[] = JSON.parse(read('e2e/fixtures/books.json'))
const quoted = (line: string) => [...line.matchAll(/'((?:[^']|'')*)'/g)].map((match) => (match[1] ?? '').replaceAll("''", "'"))
const tuples = (block: string | undefined) => (block ?? '').split('\n').filter((line) => line.trim().startsWith('('))
const sortOrder = (line: string) => Number(/(\d+)\)\s*,?\s*$/.exec(line.trim())?.[1])

function seedCategories(): SeedCategory[] {
  const seed = read('supabase/seed.sql')
  const foreign = read('supabase/seed-foreign-books.sql')
  const roots = [seed, foreign].flatMap((sql) =>
    tuples(/insert into public\.categories \(name, name_en, slug, sort_order\) values([\s\S]*?)(?:;|\non conflict)/.exec(sql)?.[1]),
  )
  const children = tuples(/from \(values([\s\S]*?)\) as c\(parent_slug, name, name_en, slug, sort_order\)/.exec(seed)?.[1])
  const foreignChildren = tuples(/from \(values([\s\S]*?)\) as c\(name, name_en, slug, sort_order\)/.exec(foreign)?.[1])
  const categories: SeedCategory[] = [
    ...roots.map((line) => {
      const [name = '', nameEn = '', slug = ''] = quoted(line)
      return { slug, name, nameEn, parent: null, sortOrder: sortOrder(line) }
    }),
    ...children.map((line) => {
      const [parent = '', name = '', nameEn = '', slug = ''] = quoted(line)
      return { slug, name, nameEn, parent, sortOrder: sortOrder(line) }
    }),
    ...foreignChildren.map((line) => {
      const [name = '', nameEn = '', slug = ''] = quoted(line)
      return { slug, name, nameEn, parent: FOREIGN_ROOT, sortOrder: sortOrder(line) }
    }),
  ]
  // Thiếu dữ liệu là lỗi (không skip): đổi định dạng seed thì sửa parser
  if (categories.length === 0 || categories.some((c) => !c.slug || !c.name || !c.nameEn || Number.isNaN(c.sortOrder))) {
    throw new Error('home-category-shelves.spec: không đọc được danh mục từ seed')
  }
  return categories
}

const categories = seedCategories()
const childrenOf = (parent: string) =>
  categories.filter((c) => c.parent === parent).sort((a, b) => a.sortOrder - b.sortOrder)
const bookCount = (parent: string) => {
  const leaves = new Set([parent, ...childrenOf(parent).map((c) => c.slug)])
  return fixture.filter((book) => leaves.has(book.category_slug)).length
}
const shelfParents = categories
  .filter((c) => c.parent === null && c.slug !== FOREIGN_ROOT)
  .sort((a, b) => a.sortOrder - b.sortOrder)
const fullParents = shelfParents.filter((c) => bookCount(c.slug) >= CATEGORY_SHELF_MIN)
const thinParents = shelfParents.filter((c) => bookCount(c.slug) < CATEGORY_SHELF_MIN)
const byslug = (slug: string) => {
  const category = categories.find((c) => c.slug === slug)
  if (!category) throw new Error(`home-category-shelves.spec: seed không có danh mục ${slug}`)
  return category
}
const foreignRoot = byslug(FOREIGN_ROOT)

const main = (page: Page) => page.getByRole('main')
const shelf = (page: Page, name: string) => main(page).getByRole('region', { name, exact: true })
const shelfBooks = (page: Page, name: string) =>
  shelf(page, name).locator('a[href^="/sach/"], a[href^="/en/books/"]')

async function noHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, viewport } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, label).toBeLessThanOrEqual(viewport)
}

test('vi: mỗi danh mục cha đủ sách một kệ (tiêu đề, Xem tất cả, chip con), thiếu sách thì không có kệ', async ({ page }) => {
  expect(fullParents.length).toBeGreaterThanOrEqual(2)
  expect(thinParents.length).toBeGreaterThanOrEqual(1)
  const errors = collectErrors(page)
  await page.goto('/')

  // Lưới danh mục cũ không còn; neo mới của link 404 "Xem danh mục"
  await expect(page.locator('#categories-title')).toHaveCount(0)
  await expect(main(page).locator('#categories')).toHaveCount(1)

  for (const parent of fullParents) {
    const region = shelf(page, parent.name)
    await expect(region, parent.slug).toHaveCount(1)
    await expect(region.getByRole('heading', { level: 2 }), parent.slug).toHaveText(parent.name)
    await expect(region.getByRole('link', { name: 'Xem tất cả', exact: true })).toHaveAttribute(
      'href',
      `/danh-muc/${parent.slug}`,
    )
    // Kệ nằm trong khung neo #categories, id theo slug
    await expect(main(page).locator(`#categories section[aria-labelledby="category-${parent.slug}"]`)).toHaveCount(1)
    await expect(shelfBooks(page, parent.name), parent.slug).toHaveCount(Math.min(CATEGORY_SHELF_SIZE, bookCount(parent.slug)))

    const children = childrenOf(parent.slug)
    const nav = region.getByRole('navigation', { name: `Danh mục con của ${parent.name}`, exact: true })
    if (children.length === 0) {
      await expect(region.getByRole('navigation'), parent.slug).toHaveCount(0)
      continue
    }
    const chips = nav.getByRole('link')
    await expect(chips).toHaveText(children.map((c) => c.name))
    for (const [index, child] of children.entries()) {
      await expect(chips.nth(index)).toHaveAttribute('href', `/danh-muc/${child.slug}`)
    }
  }

  for (const parent of thinParents) await expect(shelf(page, parent.name), parent.slug).toHaveCount(0)

  // Thứ tự kệ theo sort_order, sau kệ Sách ngoại văn
  const headings = await main(page).getByRole('heading', { level: 2 }).allTextContents()
  const positions = [foreignRoot, ...fullParents].map((c) => headings.indexOf(c.name))
  expect(positions.every((position) => position >= 0)).toBe(true)
  expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  expect(errors).toEqual([])
})

test('ví dụ cụ thể: Văn học có chip, Lịch sử - Địa lý không chip, Kinh tế không có kệ; Sách ngoại văn có chip', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const literature = byslug('van-hoc')
  const history = byslug('lich-su-dia-ly')
  const business = byslug('kinh-te')

  await expect(shelf(page, literature.name).getByRole('navigation', { name: `Danh mục con của ${literature.name}` })).toHaveCount(1)
  await expect(shelf(page, history.name)).toHaveCount(1)
  await expect(shelf(page, history.name).getByRole('navigation')).toHaveCount(0)
  await expect(shelf(page, business.name)).toHaveCount(0)

  const foreignNav = shelf(page, foreignRoot.name).getByRole('navigation', {
    name: `Danh mục con của ${foreignRoot.name}`,
    exact: true,
  })
  const foreignChildren = childrenOf(FOREIGN_ROOT)
  expect(foreignChildren.length).toBeGreaterThan(0)
  await expect(foreignNav.getByRole('link')).toHaveText(foreignChildren.map((c) => c.name))
  for (const [index, child] of foreignChildren.entries()) {
    await expect(foreignNav.getByRole('link').nth(index)).toHaveAttribute('href', `/danh-muc/${child.slug}`)
  }
  expect(errors).toEqual([])
})

test('bấm chip danh mục con của Văn học → trang danh mục con', async ({ page }) => {
  const errors = collectErrors(page)
  const literature = byslug('van-hoc')
  const [first] = childrenOf(literature.slug)
  if (!first) throw new Error('home-category-shelves.spec: Văn học không có danh mục con')
  await page.goto('/')
  await waitForSettled(page)
  await shelf(page, literature.name)
    .getByRole('navigation', { name: `Danh mục con của ${literature.name}`, exact: true })
    .getByRole('link', { name: first.name, exact: true })
    .click()
  await expect(page).toHaveURL(new RegExp(`/danh-muc/${first.slug}$`))
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(first.name)
  expect(errors).toEqual([])
})

test('/en: tên kệ / chip tiếng Anh, link /en/categories/…', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/en')
  await expect(main(page).locator('#categories')).toHaveCount(1)
  for (const parent of fullParents) {
    const region = shelf(page, parent.nameEn)
    await expect(region, parent.slug).toHaveCount(1)
    await expect(region.getByRole('link', { name: 'See all', exact: true })).toHaveAttribute(
      'href',
      `/en/categories/${parent.slug}`,
    )
    const children = childrenOf(parent.slug)
    if (children.length === 0) continue
    const chips = region.getByRole('navigation', { name: `Subcategories of ${parent.nameEn}`, exact: true }).getByRole('link')
    await expect(chips).toHaveText(children.map((c) => c.nameEn))
    await expect(chips.first()).toHaveAttribute('href', `/en/categories/${children[0]?.slug}`)
  }
  for (const parent of thinParents) await expect(shelf(page, parent.nameEn), parent.slug).toHaveCount(0)
  const foreignChips = shelf(page, foreignRoot.nameEn)
    .getByRole('navigation', { name: `Subcategories of ${foreignRoot.nameEn}`, exact: true })
    .getByRole('link')
  await expect(foreignChips).toHaveText(childrenOf(FOREIGN_ROOT).map((c) => c.nameEn))
  expect(errors).toEqual([])
})

test('không tràn ngang ở 320 / 390 / 1440; ở 390 hàng chip Sách ngoại văn cuộn ngang được', async ({ page }) => {
  const errors = collectErrors(page)
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await waitForSettled(page)
    await noHorizontalOverflow(page, `${width}`)
  }

  // Hàng chip con dài nhất của dữ liệu (5 danh mục con tiếng Anh) tràn ở 390 → khung chip tự cuộn, trang không tràn
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForSettled(page)
  const nav = shelf(page, foreignRoot.name).getByRole('navigation', {
    name: `Danh mục con của ${foreignRoot.name}`,
    exact: true,
  })
  await nav.scrollIntoViewIfNeeded()
  const { overflowX, scrollWidth, clientWidth } = await nav.evaluate((element) => ({
    overflowX: getComputedStyle(element).overflowX,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }))
  expect(overflowX).toBe('auto')
  expect(scrollWidth).toBeGreaterThan(clientWidth)
  await nav.evaluate((element) => element.scrollBy({ left: 200, behavior: 'instant' }))
  await expect.poll(() => nav.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  await noHorizontalOverflow(page, '390 sau khi cuộn chip')
  expect(errors).toEqual([])
})
