import {
  test as base,
  expect,
  type APIRequestContext,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
  type TestInfo,
} from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { adminStatePath, NO_SESSION, storageStatePath } from './auth'

// Dò lỗi chỉ đọc (sau test tay 2026-10-16): mở trang, ghi lỗi, không bấm nút nào ghi dữ liệu. Chạy ở desktop-account +
// mobile-account (Desktop Chrome / Pixel 7) vì cần phiên user + admin e2e do auth.setup.ts tạo.
// Mỗi test ghi lỗi ra test-results/crawl/<project>-<nhóm>.json (báo cáo: docs/plans/check-after-manual-test.md).
//
// Lỗi "cứng" (soft expect → test fail): status ≠ 200 (trừ 404 cố ý), lỗi console / pageerror, hydration, request 4xx/5xx
// hoặc lỗi mạng, ảnh hỏng, cuộn ngang (mobile), key i18n thô, link nội bộ hỏng.
// Chỉ ghi lại để duyệt tay (không fail): "chữ tiếng Việt trên /en" (tên sách, tác giả, NXB, mô tả fallback là dữ liệu,
// được phép; chữ nằm trong link tới sách / tác giả đã bị bỏ) và "chậm" (networkidle quá 15 giây, thường do mạng).

type Kind =
  | 'status'
  | 'console'
  | 'hydration'
  | 'request'
  | 'image'
  | 'overflow'
  | 'raw-key'
  | 'broken-link'
  | 'vi-on-en'
  | 'slow'
type Issue = { page: string; kind: Kind; detail: string }
const REVIEW_ONLY: Kind[] = ['vi-on-en', 'slow']

const NAMESPACES = Object.keys(JSON.parse(readFileSync('messages/vi.json', 'utf8')))
// "book.title", "checkout.summary.total"…: next-intl in key thô khi thiếu bản dịch
const RAW_KEY = new RegExp(`(?<![\\w@/.-])(?:${NAMESPACES.join('|')})\\.[a-z][A-Za-z0-9]*(?:\\.[A-Za-z0-9]+)*(?![\\w/-])`, 'g')
// Chữ cái chỉ tiếng Việt có (đ, ă, ơ, ư, nguyên âm mang dấu nặng / hỏi / ngã…); bỏ é / è / à vì tên riêng tiếng Anh cũng có
const VIETNAMESE =
  '[đĐăĂơƠưƯạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ]'
const HYDRATION = /hydrat|#418|#423|#425/i

type Session = 'guest' | 'account' | 'admin'

const test = base.extend<{ session: Session }>({
  session: ['guest', { option: true }],
  storageState: async ({ session }, provide, testInfo) => {
    if (session === 'guest') return provide(NO_SESSION)
    const project = testInfo.project.name
    return provide(session === 'account' ? storageStatePath(project) : adminStatePath(project.replace('-account', '-admin')))
  },
})

test.describe.configure({ timeout: 15 * 60_000 })

const isMobile = (testInfo: TestInfo) => testInfo.project.name.startsWith('mobile')

function report(testInfo: TestInfo, group: string, issues: Issue[], visited: string[]) {
  mkdirSync('test-results/crawl', { recursive: true })
  writeFileSync(
    `test-results/crawl/${testInfo.project.name}-${group}.json`,
    JSON.stringify({ project: testInfo.project.name, group, visited, issues }, null, 2),
  )
}

/** Mở một trang, ghi lỗi vào `issues`, trả về link nội bộ trên trang. `expectStatus` = 404 cho trang 404 cố ý. */
async function visit(page: Page, path: string, issues: Issue[], testInfo: TestInfo, expectStatus = 200) {
  const add = (kind: Kind, detail: string) => issues.push({ page: path, kind, detail })
  const origin = new URL(testInfo.project.use.baseURL ?? 'http://localhost:3100').origin
  const local = (url: string) => (url.startsWith(origin) ? url.slice(origin.length) : url)

  const onConsole = (message: ConsoleMessage) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // Request lỗi đã ghi ở 'response'; Chromium log thêm "Failed to load resource" cho cùng request
    if (text.startsWith('Failed to load resource')) return
    add(HYDRATION.test(text) ? 'hydration' : 'console', text.slice(0, 300))
  }
  const onPageError = (error: Error) =>
    add(HYDRATION.test(error.message) ? 'hydration' : 'console', `pageerror: ${error.message.slice(0, 300)}`)
  const onResponse = (response: Response) => {
    const status = response.status()
    if (status < 400) return
    const type = response.request().resourceType()
    const url = local(response.url())
    if (expectStatus === 404 && type === 'document' && url === path) return
    add(type === 'image' ? 'image' : 'request', `${status} ${type} ${url}`)
  }
  const onRequestFailed = (request: Request) => {
    const error = request.failure()?.errorText ?? ''
    // Hủy do điều hướng / prefetch bị bỏ: không phải lỗi
    if (error.includes('ERR_ABORTED')) return
    add(request.resourceType() === 'image' ? 'image' : 'request', `${error} ${request.resourceType()} ${local(request.url())}`)
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('response', onResponse)
  page.on('requestfailed', onRequestFailed)

  try {
    const response = await page.goto(path)
    const status = response?.status()
    if (status !== expectStatus) add('status', `HTTP ${status}, mong đợi ${expectStatus} (URL cuối: ${local(page.url())})`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => add('slow', 'networkidle quá 15 giây'))
    // Cuộn hết trang cho ảnh lazy tải
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      window.scrollTo(0, 0)
    })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)

    const facts = await page.evaluate((vietnamese) => {
      const viRegex = new RegExp(vietnamese)
      const brokenImages = [...document.images]
        .filter((img) => img.complete && img.naturalWidth === 0 && (img.currentSrc || img.src))
        .map((img) => img.currentSrc || img.src)
      // Bản sao ẩn của Suspense boundary (<div hidden id="S:…">) không phải nội dung đang hiển thị
      const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
        .filter((a) => !a.closest('[hidden]'))
        .map((a) => a.href)
      const viTexts: string[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim() ?? ''
        const parent = node.parentElement
        if (!text || !parent || !viRegex.test(text)) continue
        if (parent.closest('script, style, noscript, [hidden]')) continue
        if (parent.getClientRects().length === 0) continue
        const href = parent.closest('a')?.getAttribute('href')
        // Card sách / tên tác giả: dữ liệu, không dịch
        if (href && /^\/en\/(books|authors)\//.test(href)) continue
        // Ngữ cảnh để duyệt tay: href của link chứa chữ, hoặc thẻ cha
        const context = href ?? parent.tagName.toLowerCase()
        viTexts.push(`[${context}] ${text.slice(0, 120)}`)
      }
      const root = document.documentElement
      return {
        brokenImages,
        overflow: root.scrollWidth - root.clientWidth,
        visibleText: document.body.innerText,
        links,
        viTexts,
        lang: root.lang,
      }
    }, VIETNAMESE)

    for (const src of facts.brokenImages) add('image', `ảnh không hiển thị được: ${local(src)}`)
    if (isMobile(testInfo) && facts.overflow > 1) add('overflow', `cuộn ngang ${facts.overflow}px`)
    for (const key of new Set(facts.visibleText.match(RAW_KEY) ?? [])) add('raw-key', key)
    if (facts.lang === 'en') for (const text of [...new Set(facts.viTexts)].slice(0, 40)) add('vi-on-en', text)

    return facts.links
      .filter((href) => href.startsWith(origin))
      .map((href) => {
        const url = new URL(href)
        return `${url.pathname}${url.search}`
      })
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
    page.off('response', onResponse)
    page.off('requestfailed', onRequestFailed)
  }
}

/** GET từng link nội bộ (theo chuyển hướng), 4 request song song; ≥ 400 → hỏng. Bỏ /api (không phải trang). */
async function checkLinks(request: APIRequestContext, sources: Map<string, string>, issues: Issue[]) {
  const queue = [...sources.keys()].filter((link) => !link.startsWith('/api/'))
  const worker = async () => {
    for (let link = queue.shift(); link !== undefined; link = queue.shift()) {
      const from = sources.get(link) ?? ''
      const response = await request.get(link, { timeout: 30_000 }).catch((error: Error) => error)
      if (response instanceof Error) issues.push({ page: from, kind: 'broken-link', detail: `${link} → ${response.message.slice(0, 120)}` })
      else if (response.status() >= 400) issues.push({ page: from, kind: 'broken-link', detail: `${link} → HTTP ${response.status()}` })
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
}

/** Đi qua danh sách trang, kiểm tra link nội bộ, ghi file, rồi soft-expect không có lỗi cứng */
async function crawl(page: Page, request: APIRequestContext, testInfo: TestInfo, group: string, pages: { path: string; status?: number }[]) {
  const issues: Issue[] = []
  // link → trang đầu tiên chứa link
  const sources = new Map<string, string>()
  try {
    for (const { path, status } of pages) {
      await test.step(path, async () => {
        const links = await visit(page, path, issues, testInfo, status)
        // Trang 404 cố ý: link đổi ngôn ngữ trỏ tới chính đường dẫn không tồn tại → không kiểm
        if (status === 404) return
        for (const link of links) if (!sources.has(link)) sources.set(link, path)
      })
    }
    await test.step(`link nội bộ (${sources.size})`, () => checkLinks(request, sources, issues))
  } finally {
    report(testInfo, group, issues, pages.map((entry) => entry.path))
  }
  const hard = issues.filter((issue) => !REVIEW_ONLY.includes(issue.kind))
  expect.soft(hard, `${group}: lỗi trên ${pages.length} trang`).toEqual([])
}

/** Đường dẫn trong sitemap.xml (host có thể là localhost:3000 khi chưa đặt SITE_URL → chỉ lấy pathname) */
async function sitemapPaths(request: APIRequestContext) {
  const xml = await (await request.get('/sitemap.xml')).text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].flatMap((match) => (match[1] ? [new URL(match[1]).pathname] : []))
}

const sample = <T,>(items: T[], count: number) =>
  items
    .map((item) => ({ item, key: Math.random() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, count)
    .map(({ item }) => item)

const toEn = (vi: string) =>
  `/en${vi.replace(/^\/sach(?=\/|$)/, '/books').replace(/^\/danh-muc\//, '/categories/').replace(/^\/tac-gia\//, '/authors/')}`

const both = (paths: string[]) => paths.flatMap((path) => [{ path }, { path: toEn(path) }])

test.describe('khách', () => {
  test('trang chủ, tất cả sách, tìm kiếm, giỏ, đăng nhập / đăng ký / quên mật khẩu, 404', async ({ page, request }, testInfo) => {
    await crawl(page, request, testInfo, 'static', [
      { path: '/' },
      { path: '/en' },
      { path: '/sach' },
      { path: '/en/books' },
      { path: '/sach?lang=en&sort=price-asc&page=2' },
      { path: '/tim-kiem?q=nguyen%20nhat%20anh' },
      { path: '/en/search?q=harry' },
      { path: '/tim-kiem?q=zzqqxx' },
      { path: '/gio-hang' },
      { path: '/en/cart' },
      { path: '/dang-nhap' },
      { path: '/en/login' },
      { path: '/dang-ky' },
      { path: '/en/register' },
      { path: '/quen-mat-khau' },
      { path: '/en/forgot-password' },
      { path: '/sach/khong-ton-tai-crawl', status: 404 },
      { path: '/en/books/khong-ton-tai-crawl', status: 404 },
      { path: '/trang-khong-co-crawl', status: 404 },
      { path: '/en/trang-khong-co-crawl', status: 404 },
    ])
  })

  test('sitemap.xml, robots.txt', async ({ request }, testInfo) => {
    const issues: Issue[] = []
    for (const path of ['/sitemap.xml', '/robots.txt']) {
      const response = await request.get(path)
      if (response.status() !== 200) issues.push({ page: path, kind: 'status', detail: `HTTP ${response.status()}` })
    }
    report(testInfo, 'seo-files', issues, ['/sitemap.xml', '/robots.txt'])
    expect.soft(issues).toEqual([])
  })

  test('mọi danh mục (vi + en)', async ({ page, request }, testInfo) => {
    const categories = (await sitemapPaths(request)).filter((path) => path.startsWith('/danh-muc/'))
    expect(categories.length).toBeGreaterThan(0)
    await crawl(page, request, testInfo, 'categories', both(categories))
  })

  test('10 sách ngẫu nhiên (vi + en)', async ({ page, request }, testInfo) => {
    const books = sample((await sitemapPaths(request)).filter((path) => path.startsWith('/sach/')), 10)
    await crawl(page, request, testInfo, 'books', both(books))
  })

  test('5 tác giả ngẫu nhiên (vi + en)', async ({ page, request }, testInfo) => {
    const authors = sample((await sitemapPaths(request)).filter((path) => path.startsWith('/tac-gia/')), 5)
    await crawl(page, request, testInfo, 'authors', both(authors))
  })
})

test.describe('tài khoản e2e', () => {
  test.use({ session: 'account' })

  test('tài khoản, đơn hàng, sổ địa chỉ, giỏ, thanh toán (vi + en)', async ({ page }, testInfo) => {
    const vi = ['/tai-khoan', '/tai-khoan/don-hang', '/tai-khoan/dia-chi', '/tai-khoan/dia-chi/moi', '/gio-hang', '/thanh-toan']
    const en = ['/en/account', '/en/account/orders', '/en/account/addresses', '/en/account/addresses/new', '/en/cart', '/en/checkout']
    // page.request: cùng cookie phiên với trang (link trong trang tài khoản cần đăng nhập)
    await crawl(page, page.request, testInfo, 'account', [...vi, ...en].map((path) => ({ path })))
  })
})

test.describe('admin e2e', () => {
  test.use({ session: 'admin' })

  test('mọi trang /admin', async ({ page }, testInfo) => {
    const lists = ['/admin/sach', '/admin/danh-muc', '/admin/tac-gia', '/admin/don-hang', '/admin/voucher']
    // Trang chi tiết: link đầu tiên của mỗi danh sách (đọc href, không bấm)
    const details: string[] = []
    for (const list of lists) {
      await page.goto(list)
      const href = await page
        .getByRole('main')
        .locator(`a[href^="${list}/"]:not([href$="/moi"])`)
        .first()
        .getAttribute('href', { timeout: 10_000 })
        .catch(() => null)
      if (href) details.push(href)
    }
    const pages = [
      '/admin',
      ...lists,
      '/admin/danh-muc/moi',
      '/admin/tac-gia/moi',
      '/admin/voucher/moi',
      '/admin/danh-gia',
      '/admin/sach?q=nguyen',
      '/admin/don-hang?status=pending',
      ...details,
    ]
    await crawl(page, page.request, testInfo, 'admin', pages.map((path) => ({ path })))
  })
})
