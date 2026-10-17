/**
 * Đo tốc độ trên bản deploy (mặc định https://nha-sach-may.vercel.app) bằng Playwright. Chạy local:
 *   npx tsx scripts/perf/measure.ts [--base <url>] [--out <file.json>] [--runs 3]
 *   npx tsx scripts/perf/measure.ts --only "lọc Tiếng Anh"   # chỉ đo trang / thao tác có tên chứa chuỗi này
 *   npx tsx scripts/perf/measure.ts --cleanup-only    # lượt đo bị ngắt giữa chừng: dọn mọi dữ liệu e2e rồi đếm phần sót
 *   npx tsx scripts/perf/measure.ts --check-leftovers # chỉ đếm dữ liệu e2e còn trong DB, không xóa gì
 *
 * - Trang: TTFB, FCP, LCP, CLS, TBT; "lạnh" = context mới (cache trình duyệt trống), "ấm" = tải lại trong cùng context.
 * - Thao tác: thời gian từ lúc bấm tới lúc thấy kết quả + INP (event timing dài nhất của thao tác).
 * - Ảnh bìa: /_next/image so với tải thẳng WebP từ Supabase Storage (thời gian, tỉ lệ lỗi, x-vercel-cache).
 * - desktop: Desktop Chrome, mạng thật. mobile: Pixel 7 + mô phỏng 4G chậm (RTT 150 ms, 1.6 Mbps / 750 Kbps) + CPU
 *   chậm 4x như Lighthouse mobile.
 *
 * Thao tác ghi (giỏ, voucher, đổi trạng thái đơn) chỉ chạm dữ liệu e2e tạo tại chỗ bằng scripts/e2e-user.ts (user, admin,
 * sách e2e-shop-perf-…, voucher E2E-ADMIN-…, đơn của user e2e); dọn ở finally rồi đếm dữ liệu e2e còn sót.
 * Không chạy cùng lúc với `npm run test:e2e` (setup e2e xóa mọi user e2e).
 */
import { chromium, devices, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import {
  cleanupE2eUsers,
  clearCart,
  createE2eUser,
  createE2eVoucher,
  createShopBooks,
  deleteE2eUsers,
  deleteE2eVouchers,
  deleteShopBooks,
  e2eLeftovers,
  makeAdmin,
  placeE2eOrder,
  seedAddress,
  setCartItem,
  signedInClient,
  type E2eUser,
} from '../e2e-user'

const CLEANUP_ONLY = process.argv.includes('--cleanup-only')
const CHECK_ONLY = process.argv.includes('--check-leftovers')
const args = new Map<string, string>()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i] ?? '', process.argv[i + 1] ?? '')
const BASE = args.get('--base') ?? 'https://nha-sach-may.vercel.app'
const OUT = args.get('--out') ?? 'perf-result.json'
const RUNS = Number(args.get('--runs') ?? 3)
const ONLY = args.get('--only')
// --only "a,b": tên chứa một trong các chuỗi
const selected = (name: string) => !ONLY || ONLY.split(',').some((part) => name.includes(part.trim()))

type Device = 'desktop' | 'mobile'
// --devices desktop | mobile | desktop,mobile (mặc định cả hai)
const DEVICES: Device[] = (args.get('--devices') ?? 'desktop,mobile')
  .split(',')
  .flatMap((name): Device[] => (name === 'desktop' || name === 'mobile' ? [name] : []))

const median = (values: number[]) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (sorted.length === 0) return NaN
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? (sorted[mid] ?? NaN) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

// ---------- Trình duyệt ----------

async function newContext(browser: Browser, device: Device, storageState?: Awaited<ReturnType<BrowserContext['storageState']>>) {
  const context = await browser.newContext({
    ...(device === 'mobile' ? devices['Pixel 7'] : devices['Desktop Chrome']),
    baseURL: BASE,
    storageState,
  })
  // Quan sát hiệu năng từ đầu trang (trước mọi script của app)
  await context.addInitScript(() => {
    // tsx biên dịch hàm có tên thành __name(fn, 'tên'): helper đó không có trong trình duyệt
    Reflect.set(globalThis, '__name', (target: unknown) => target)
    const store = {
      lcp: 0,
      lcpElement: '',
      cls: 0,
      shifts: [] as { value: number; at: number; sources: string[] }[],
      longTasks: [] as { start: number; duration: number }[],
      events: [] as number[],
    }
    // Mô tả ngắn phần tử (thẻ#id.class[data-testid]) để biết cái gì xê dịch / là LCP
    const describe = (node: unknown) => {
      if (!(node instanceof Element)) return ''
      const testId = node.getAttribute('data-testid')
      const cls = (node.getAttribute('class') ?? '').split(' ').slice(0, 3).join('.')
      return `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}${cls ? '.' + cls : ''}${testId ? `[${testId}]` : ''}`
    }
    Object.assign(window, { __perf: store })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        store.lcp = entry.startTime
        store.lcpElement = describe(Reflect.get(entry, 'element'))
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (Reflect.get(entry, 'hadRecentInput')) continue
        const value = Number(Reflect.get(entry, 'value') ?? 0)
        store.cls += value
        const sources: unknown[] = Reflect.get(entry, 'sources') ?? []
        store.shifts.push({ value, at: entry.startTime, sources: sources.map((source) => describe(Reflect.get(Object(source), 'node'))) })
      }
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.longTasks.push({ start: entry.startTime, duration: entry.duration })
    }).observe({ type: 'longtask', buffered: true })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.events.push(entry.duration)
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
  })
  return context
}

async function newPage(context: BrowserContext, device: Device) {
  const page = await context.newPage()
  if (device === 'mobile') {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  }
  return page
}

async function waitForHydration(page: Page, selector: string) {
  await page.waitForFunction((sel) => {
    const element = document.querySelector(sel)
    return element !== null && Object.keys(element).some((key) => key.startsWith('__reactProps'))
  }, selector)
}

async function login(browser: Browser, user: E2eUser) {
  const context = await newContext(browser, 'desktop')
  const page = await context.newPage()
  await page.goto('/dang-nhap')
  await waitForHydration(page, 'form button[type="submit"]')
  await page.getByRole('main').getByLabel('Email').fill(user.email)
  await page.getByRole('main').getByLabel('Mật khẩu', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await page.waitForURL(/\/tai-khoan$/, { timeout: 30_000 })
  const state = await context.storageState()
  await context.close()
  return state
}

// ---------- Trang ----------

type PageMetrics = {
  status: number
  ttfb: number
  fcp: number
  lcp: number
  lcpElement: string
  cls: number
  shifts: { value: number; at: number; sources: string[] }[]
  tbt: number
  load: number
}

async function loadMetrics(page: Page, path: string): Promise<PageMetrics> {
  const response = await page.goto(path, { waitUntil: 'load', timeout: 90_000 })
  // LCP / long task sau load: chờ thêm cho chắc
  await page.waitForTimeout(2_500)
  return page.evaluate((status) => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? NaN
    const store = Reflect.get(window, '__perf')
    const longTasks: { start: number; duration: number }[] = store?.longTasks ?? []
    const tbt = longTasks.filter((task) => task.start >= fcp).reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0)
    return {
      status,
      ttfb: nav ? Reflect.get(nav, 'responseStart') - Reflect.get(nav, 'startTime') : NaN,
      fcp,
      lcp: store?.lcp ?? NaN,
      lcpElement: store?.lcpElement ?? '',
      cls: store?.cls ?? NaN,
      shifts: (store?.shifts ?? []).filter((shift: { value: number }) => shift.value >= 0.01),
      tbt,
      load: nav ? Reflect.get(nav, 'loadEventEnd') - Reflect.get(nav, 'startTime') : NaN,
    }
  }, response?.status() ?? 0)
}

type PageSpec = { name: string; path: string; session?: 'user' | 'admin' }

async function measurePage(browser: Browser, device: Device, spec: PageSpec, sessions: Sessions) {
  const storage = spec.session ? sessions[spec.session] : undefined
  const cold: PageMetrics[] = []
  for (let run = 0; run < RUNS; run++) {
    const context = await newContext(browser, device, storage)
    const page = await newPage(context, device)
    cold.push(await loadMetrics(page, spec.path))
    await context.close()
  }
  const context = await newContext(browser, device, storage)
  const page = await newPage(context, device)
  await loadMetrics(page, spec.path)
  const warm: PageMetrics[] = []
  for (let run = 0; run < RUNS; run++) warm.push(await loadMetrics(page, spec.path))
  await context.close()
  const summarize = (list: PageMetrics[]) => ({
    status: list.map((m) => m.status),
    ttfb: median(list.map((m) => m.ttfb)),
    fcp: median(list.map((m) => m.fcp)),
    lcp: median(list.map((m) => m.lcp)),
    cls: median(list.map((m) => m.cls)),
    tbt: median(list.map((m) => m.tbt)),
    load: median(list.map((m) => m.load)),
  })
  return { ...spec, device, cold: summarize(cold), warm: summarize(warm), firstCold: cold[0] }
}

// ---------- Thao tác ----------

type Sessions = { user: Awaited<ReturnType<typeof login>>; admin: Awaited<ReturnType<typeof login>> }

/** Thời gian từ lúc bấm tới khi `done` xong + INP (event dài nhất kể từ lúc bấm) */
async function timed(page: Page, act: () => Promise<void>, done: () => Promise<unknown>) {
  await page.evaluate(() => {
    const store = Reflect.get(window, '__perf')
    if (store) store.events = []
  })
  const start = Date.now()
  await act()
  await done()
  const ms = Date.now() - start
  await page.waitForTimeout(300)
  const inp = await page.evaluate(() => Math.max(0, ...((Reflect.get(window, '__perf')?.events as number[]) ?? [])))
  return { ms, inp }
}

type Interaction = {
  name: string
  session?: 'user' | 'admin'
  /** Chuẩn bị mỗi lượt (dữ liệu, mở trang), không tính giờ */
  prepare: (page: Page, run: number, device: Device) => Promise<void>
  run: (page: Page, run: number, device: Device) => Promise<{ ms: number; inp: number }>
}

async function measureInteraction(browser: Browser, device: Device, interaction: Interaction, sessions: Sessions) {
  const results: { ms: number; inp: number }[] = []
  for (let run = 0; run < RUNS; run++) {
    const context = await newContext(browser, device, interaction.session ? sessions[interaction.session] : undefined)
    const page = await newPage(context, device)
    try {
      await interaction.prepare(page, run, device)
      results.push(await interaction.run(page, run, device))
    } catch (error) {
      console.error(`  ${interaction.name} (${device}, lượt ${run + 1}): ${error instanceof Error ? error.message.split('\n')[0] : error}`)
      results.push({ ms: NaN, inp: NaN })
    } finally {
      await context.close()
    }
  }
  return {
    name: interaction.name,
    device,
    first: results[0],
    ms: median(results.map((r) => r.ms)),
    inp: median(results.map((r) => r.inp)),
    runs: results,
  }
}

const main = (page: Page) => page.getByRole('main')
const bookLinks = (page: Page) => main(page).locator('a[href^="/sach/"]').filter({ visible: true })

function interactions(data: Fixtures): Interaction[] {
  const firstHref = (page: Page) => bookLinks(page).first().getAttribute('href')
  const changedFrom = async (page: Page, before: string | null) =>
    page.waitForFunction(
      (prev) => document.querySelector('main a[href^="/sach/"]')?.getAttribute('href') !== prev,
      before,
      { timeout: 30_000 },
    )
  return [
    {
      name: 'Chuyển trang: trang chủ → bấm sách đầu tiên',
      prepare: async (page) => {
        await page.goto('/')
        await waitForHydration(page, 'main a[href^="/sach/"]')
      },
      run: (page) =>
        timed(
          page,
          () => bookLinks(page).first().click(),
          () => main(page).getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 }),
        ),
    },
    {
      name: '/sach: sắp xếp giá tăng dần',
      prepare: async (page) => {
        await page.goto('/sach')
        await waitForHydration(page, 'main select')
      },
      run: async (page) => {
        const before = await firstHref(page)
        return timed(
          page,
          () => page.getByRole('combobox', { name: /Sắp xếp/ }).selectOption('price-asc').then(() => undefined),
          () => changedFrom(page, before),
        )
      },
    },
    {
      name: '/sach: lọc Tiếng Anh',
      prepare: async (page) => {
        await page.goto('/sach')
        await waitForHydration(page, 'main select')
      },
      run: async (page, _run, device) => {
        const before = await firstHref(page)
        return timed(
          page,
          async () => {
            if (device === 'mobile') {
              await page.getByRole('button', { name: /Bộ lọc/ }).click()
              await page.getByRole('dialog').getByRole('link', { name: 'Tiếng Anh', exact: true }).click()
            } else {
              await main(page).getByRole('link', { name: 'Tiếng Anh', exact: true }).filter({ visible: true }).first().click()
            }
          },
          async () => {
            await page.waitForURL(/lang=en/, { timeout: 30_000 })
            await changedFrom(page, before)
          },
        )
      },
    },
    {
      name: '/sach: sang trang 2',
      prepare: async (page) => {
        await page.goto('/sach')
        await waitForHydration(page, 'main select')
      },
      run: async (page) => {
        const before = await firstHref(page)
        return timed(
          page,
          () => page.getByRole('navigation', { name: 'Phân trang' }).getByRole('link', { name: 'Trang 2' }).click(),
          () => changedFrom(page, before),
        )
      },
    },
    {
      name: 'Palette: mở (Ctrl K)',
      prepare: async (page) => {
        await page.goto('/')
        await waitForHydration(page, 'header button[aria-haspopup="dialog"]')
        await page.waitForLoadState('networkidle')
      },
      run: (page) =>
        timed(
          page,
          () => page.keyboard.press('ControlOrMeta+k'),
          () => page.getByRole('dialog').getByRole('combobox').waitFor({ timeout: 30_000 }),
        ),
    },
    {
      name: 'Palette: gõ "nguyen" → có gợi ý',
      prepare: async (page) => {
        await page.goto('/')
        await waitForHydration(page, 'header button[aria-haspopup="dialog"]')
        await page.waitForLoadState('networkidle')
        await page.keyboard.press('ControlOrMeta+k')
        await page.getByRole('dialog').getByRole('combobox').waitFor({ timeout: 30_000 })
      },
      run: (page) =>
        timed(
          page,
          () => page.getByRole('dialog').getByRole('combobox').fill('nguyen'),
          () => page.getByRole('dialog').getByRole('option').first().waitFor({ timeout: 30_000 }),
        ),
    },
    {
      name: 'Thêm vào giỏ (đã đăng nhập): badge cập nhật',
      session: 'user',
      prepare: async (page) => {
        await clearCart(data.user.id)
        await page.goto(`/sach/${data.cartBook}`)
        await waitForHydration(page, 'main form button[type="submit"]')
      },
      run: async (page) => {
        const result = await timed(
          page,
          () => main(page).locator('form button[type="submit"]').click(),
          () => page.getByRole('banner').getByTestId('cart-count').filter({ hasText: '1' }).waitFor({ timeout: 30_000 }),
        )
        // Badge là optimistic: chờ server ghi xong rồi mới sang lượt sau (lượt sau xóa giỏ trước)
        await main(page).getByText(/Đã thêm vào giỏ/).waitFor({ timeout: 30_000 })
        return result
      },
    },
    {
      name: 'Thêm vào giỏ (đã đăng nhập): server ghi xong',
      session: 'user',
      prepare: async (page) => {
        await clearCart(data.user.id)
        await page.goto(`/sach/${data.cartBook}`)
        await waitForHydration(page, 'main form button[type="submit"]')
        // Bấm trước khi header (phần theo phiên) stream xong thì nút chưa biết phiên → sau action gọi router.refresh()
        // (render lại cả phần động của trang sách). Chờ link tài khoản để đo đúng luồng của người đã đăng nhập.
        await page.getByRole('banner').getByRole('link', { name: /Tài khoản của/ }).waitFor({ timeout: 30_000 })
      },
      run: (page) =>
        timed(
          page,
          () => main(page).locator('form button[type="submit"]').click(),
          () => main(page).getByText(/Đã thêm vào giỏ/).waitFor({ timeout: 30_000 }),
        ),
    },
    {
      name: 'Thanh toán: áp dụng voucher',
      session: 'user',
      prepare: async (page) => {
        await clearCart(data.user.id)
        await setCartItem(data.user.id, data.checkoutBookId, 1)
        await page.goto('/thanh-toan')
        await main(page).getByLabel('Mã giảm giá').waitFor({ timeout: 30_000 })
        await main(page).getByLabel('Mã giảm giá').fill(data.voucher)
      },
      run: (page) =>
        timed(
          page,
          () => main(page).getByRole('button', { name: 'Áp dụng' }).click(),
          () => main(page).getByText(`Đã áp dụng mã ${data.voucher}`).waitFor({ timeout: 30_000 }),
        ),
    },
    {
      name: 'Admin: đổi trạng thái đơn (Xác nhận đơn)',
      session: 'admin',
      prepare: async (page, run, device) => {
        await page.goto(`/admin/don-hang/${data.orders[device][run]}`)
        await waitForHydration(page, 'main aside form button[type="submit"]')
      },
      run: (page) =>
        timed(
          page,
          () => main(page).getByRole('button', { name: 'Xác nhận đơn' }).click(),
          () => main(page).getByRole('status').filter({ hasText: 'Đã cập nhật trạng thái đơn.' }).waitFor({ timeout: 30_000 }),
        ),
    },
  ]
}

// ---------- Ảnh bìa ----------

/** Ảnh trình duyệt thật sự tải (currentSrc theo srcset + DPR của thiết bị) trên trang danh mục và trang sách */
async function loadedImages(browser: Browser, device: Device) {
  const context = await newContext(browser, device)
  const page = await context.newPage()
  const urls = new Set<string>()
  for (const path of ['/danh-muc/van-hoc', '/sach/sapiens']) {
    await page.goto(path, { waitUntil: 'load' })
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y)
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
    })
    await page.waitForLoadState('networkidle').catch(() => undefined)
    const current = await page.evaluate(() =>
      [...document.images].map((img) => img.currentSrc).filter((src) => src.includes('/_next/image')),
    )
    for (const src of current) urls.add(src)
  }
  await context.close()
  return [...urls]
}

async function measureImages(browser: Browser) {
  const optimized = [...(await loadedImages(browser, 'desktop')), ...(await loadedImages(browser, 'mobile'))]
  const widths = optimized.map((src) => new URL(src).searchParams.get('w'))
  const direct = [...new Set(optimized.map((src) => new URL(src).searchParams.get('url') ?? ''))]

  const timeFetch = async (url: string) => {
    const start = performance.now()
    try {
      const response = await fetch(url, { headers: { accept: 'image/avif,image/webp,*/*' } })
      const body = await response.arrayBuffer()
      return {
        ms: performance.now() - start,
        status: response.status,
        bytes: body.byteLength,
        cache: response.headers.get('x-vercel-cache') ?? response.headers.get('cf-cache-status') ?? '',
        type: response.headers.get('content-type') ?? '',
      }
    } catch (error) {
      return { ms: performance.now() - start, status: 0, bytes: 0, cache: String(error), type: '' }
    }
  }
  const round = async (urls: string[]) => {
    const results = []
    for (const url of urls) results.push(await timeFetch(url))
    return results
  }
  const summarize = (list: Awaited<ReturnType<typeof timeFetch>>[]) => ({
    count: list.length,
    medianMs: median(list.map((r) => r.ms)),
    p90Ms: list.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(list.length * 0.9)] ?? NaN,
    errors: list.filter((r) => r.status !== 200).length,
    medianBytes: median(list.map((r) => r.bytes)),
    cache: Object.fromEntries(
      [...new Set(list.map((r) => r.cache))].map((key) => [key, list.filter((r) => r.cache === key).length]),
    ),
    types: [...new Set(list.map((r) => r.type))],
  })
  const optimizedUrls = [...new Set(optimized)]
  return {
    widths: Object.fromEntries([...new Set(widths)].map((w) => [w, widths.filter((x) => x === w).length])),
    optimizedFirst: summarize(await round(optimizedUrls)),
    optimizedRepeat: summarize(await round(optimizedUrls)),
    directFirst: summarize(await round(direct)),
    directRepeat: summarize(await round(direct)),
    sampleOptimized: optimizedUrls[0],
    sampleDirect: direct[0],
  }
}

// ---------- Dữ liệu e2e tạm ----------

type Fixtures = {
  user: E2eUser
  admin: E2eUser
  voucher: string
  cartBook: string
  checkoutBookId: number
  orders: Record<Device, string[]>
}

async function setupFixtures(): Promise<Fixtures> {
  const [user, admin] = await Promise.all([createE2eUser('perf'), createE2eUser('perf-admin')])
  await makeAdmin(admin.id)
  const books = await createShopBooks('perf')
  const [voucher, addressId] = await Promise.all([createE2eVoucher(), seedAddress(user.id)])
  const plenty = books.plenty[0]
  const regular = books.regular[0]
  const checkout = books.regular[1]
  if (!plenty || !regular || !checkout) throw new Error('Thiếu sách e2e')
  // Mỗi lượt đổi trạng thái cần một đơn còn "chờ xác nhận"
  const client = await signedInClient(user)
  const orders: Record<Device, string[]> = { desktop: [], mobile: [] }
  for (const device of DEVICES) {
    for (let run = 0; run < RUNS; run++) {
      const order = await placeE2eOrder(client, user.id, { addressId, bookId: plenty.id, quantity: 1 })
      orders[device].push(order.order_code)
    }
  }
  await clearCart(user.id)
  return { user, admin, voucher: voucher.code, cartBook: regular.slug, checkoutBookId: checkout.id, orders }
}

async function cleanup(fixtures: Partial<Fixtures>, voucherCodes: string[]) {
  const ids = [fixtures.user?.id, fixtures.admin?.id].flatMap((id) => (id ? [id] : []))
  // Hủy + xóa đơn (hoàn kho sách e2e) trước khi xóa user, rồi sách / danh mục e2e-shop và voucher
  await deleteE2eUsers(ids)
  await deleteShopBooks()
  await deleteE2eVouchers(voucherCodes)
  return e2eLeftovers()
}

// ---------- Chạy ----------

const PAGES: PageSpec[] = [
  { name: 'Trang chủ', path: '/' },
  { name: 'Tất cả sách', path: '/sach' },
  { name: 'Tất cả sách, lọc + trang 2', path: '/sach?lang=en&sort=price-asc&page=2' },
  { name: 'Danh mục', path: '/danh-muc/van-hoc' },
  { name: 'Trang sách', path: '/sach/sapiens' },
  { name: 'Tìm kiếm', path: '/tim-kiem?q=nguyen%20nhat%20anh' },
  { name: 'Giỏ hàng (khách)', path: '/gio-hang' },
  { name: 'Thanh toán', path: '/thanh-toan', session: 'user' },
  { name: 'Đơn hàng của tôi', path: '/tai-khoan/don-hang', session: 'user' },
  { name: 'Admin tổng quan', path: '/admin', session: 'admin' },
  { name: 'Admin đơn hàng', path: '/admin/don-hang', session: 'admin' },
]

async function run() {
  const startedAt = new Date().toISOString()
  const before = await e2eLeftovers()
  console.log('Dữ liệu e2e trước khi đo:', before)
  let fixtures: Partial<Fixtures> = {}
  const voucherCodes: string[] = []
  const browser = await chromium.launch()
  const result: Record<string, unknown> = { base: BASE, startedAt, runs: RUNS, leftoversBefore: before }
  try {
    const data = await setupFixtures()
    fixtures = data
    voucherCodes.push(data.voucher)
    const sessions: Sessions = { user: await login(browser, data.user), admin: await login(browser, data.admin) }
    // Thanh toán cần giỏ có sách
    await setCartItem(data.user.id, data.checkoutBookId, 1)

    const pages = []
    for (const device of DEVICES) {
      for (const spec of PAGES.filter((page) => selected(page.name))) {
        console.log(`${Date.now()} trang ${device} ${spec.path}`)
        pages.push(await measurePage(browser, device, spec, sessions))
      }
    }
    result.pages = pages

    const actions = []
    for (const device of DEVICES) {
      for (const interaction of interactions(data).filter((item) => selected(item.name))) {
        console.log(`${Date.now()} thao tác ${device} ${interaction.name}`)
        actions.push(await measureInteraction(browser, device, interaction, sessions))
      }
    }
    result.interactions = actions
    if (selected('ảnh bìa')) {
      console.log('ảnh bìa')
      result.images = await measureImages(browser)
    }
  } finally {
    await browser.close()
    result.leftoversAfter = await cleanup(fixtures, voucherCodes)
    result.finishedAt = new Date().toISOString()
    writeFileSync(OUT, JSON.stringify(result, null, 2))
    console.log('Dữ liệu e2e sau khi dọn:', result.leftoversAfter)
    console.log(`Kết quả: ${OUT}`)
  }
}

async function cleanupOnly() {
  const removed = await cleanupE2eUsers()
  console.log(`Đã xóa ${removed} user e2e (kèm đơn, sách / danh mục / voucher e2e)`)
  console.log('Dữ liệu e2e còn lại:', await e2eLeftovers())
}

async function checkOnly() {
  console.log('Dữ liệu e2e còn lại:', await e2eLeftovers())
}

;(CHECK_ONLY ? checkOnly() : CLEANUP_ONLY ? cleanupOnly() : run()).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
