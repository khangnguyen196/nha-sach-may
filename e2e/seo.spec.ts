import { expect, test } from '@playwright/test'

// SEO (Phase 10): sitemap, robots, JSON-LD, ảnh OG, 404 thật cho slug không tồn tại. Không cần tài khoản.

test('sitemap.xml: trang công khai + hreflang, không có trang riêng tư', async ({ request }) => {
  const response = await request.get('/sitemap.xml')
  expect(response.status()).toBe(200)
  const xml = await response.text()
  expect(xml).toContain('/sach/sapiens</loc>')
  expect(xml).toMatch(/hreflang="en" href="[^"]*\/en\/books\/sapiens"/)
  expect(xml).toContain('/danh-muc/van-hoc</loc>')
  expect(xml).not.toMatch(/tai-khoan|gio-hang|thanh-toan|\/admin|e2e-/)
})

test('robots.txt: chặn admin, api, trang riêng tư; trỏ sitemap', async ({ request }) => {
  const text = await (await request.get('/robots.txt')).text()
  for (const path of ['/admin', '/api/', '/tai-khoan', '/thanh-toan', '/en/account']) expect(text).toContain(`Disallow: ${path}`)
  expect(text).toMatch(/Sitemap: \S+\/sitemap\.xml/)
})

test('trang sách: JSON-LD Book + Offer VND + Breadcrumb, og:image là bìa', async ({ page }) => {
  await page.goto('/sach/sapiens')
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()
  const graph = scripts.map((text) => JSON.parse(text)).find((data) => Array.isArray(data['@graph']))?.['@graph']
  expect(graph?.[0]).toMatchObject({
    '@type': ['Book', 'Product'],
    name: 'Sapiens',
    offers: { '@type': 'Offer', priceCurrency: 'VND' },
  })
  expect(graph?.[0].offers.url).toMatch(/\/sach\/sapiens$/)
  expect(graph?.[1]).toMatchObject({ '@type': 'BreadcrumbList' })
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /book-covers\//)
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'book')
})

test('trang chủ: JSON-LD WebSite + SearchAction, ảnh OG mặc định tải được', async ({ page, request }) => {
  await page.goto('/')
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()
  expect(scripts.map((text) => JSON.parse(text))).toContainEqual(expect.objectContaining({ '@type': 'WebSite' }))
  const image = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(image).toBeTruthy()
  const response = await request.get(new URL(image ?? '').pathname)
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('image/png')
})

for (const [path, heading] of [
  ['/sach/khong-ton-tai-e2e', 'Không tìm thấy trang'],
  ['/en/books/khong-ton-tai-e2e', 'Page not found'],
  ['/danh-muc/khong-ton-tai-e2e', 'Không tìm thấy trang'],
  ['/tac-gia/khong-ton-tai-e2e', 'Không tìm thấy trang'],
] as const) {
  test(`slug không tồn tại → HTTP 404 + trang 404 đúng ngôn ngữ: ${path}`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  })
}

test('slug có thật vẫn 200; Tất cả sách không bị coi là slug', async ({ request }) => {
  for (const path of ['/sach/sapiens', '/en/books/sapiens', '/danh-muc/van-hoc', '/sach', '/en/books']) {
    expect((await request.get(path)).status(), path).toBe(200)
  }
})
