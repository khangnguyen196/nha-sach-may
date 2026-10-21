import { expect, test } from '@playwright/test'

// waitForSettled (helpers.ts) đếm comment `$?` (boundary Suspense đang chờ) và `$~` (`$RC` đặt khi nội dung đã tới, chờ
// `$RV` hiện) của React. Nâng react / next mà React đổi marker → poll ra 0 ngay, helper qua tức thì không báo gì, test đo
// bố cục (CLS ở catalog.spec, layout.spec) xanh giả. Test này đỏ sau khi nâng react / next → sửa waitForSettled theo
// marker mới, không xóa test. Riêng trường hợp DOM vẫn dùng `$~` mà runtime chỉ đổi chỗ (gán `$~` sang hàm khác, script
// ra file ngoài) → sửa test, giữ helper.
// Trang sách đọc params trong <Suspense> → nội dung luôn nằm trong boundary chờ `$RC`, kể cả slug đã prerender; sapiens
// luôn có trong dữ liệu e2e. request.get lấy HTML thô (không chạy JS, `$RC` chưa đổi comment nào).
test('HTML trang sách có marker Suspense mà waitForSettled đếm', async ({ request, isMobile }) => {
  test.skip(isMobile, 'Chỉ đọc HTML, không phụ thuộc thiết bị')
  const response = await request.get('/sach/sapiens')
  expect(response.status()).toBe(200)
  const html = await response.text()
  // Không toContain: đỏ thì in cả trang vào log
  expect(html.includes('<!--$?-->'), 'comment <!--$?--> của boundary đang chờ').toBe(true)
  const runtime = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map(([, body]) => body)
    .find((body) => body.includes('$RC='))
  expect(runtime, 'script $RC nội tuyến').toBeDefined()
  expect(runtime).toMatch(/\.data\s*=\s*"\$~"/)
})
