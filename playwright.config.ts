import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
// Spec cần user e2e (admin API → SUPABASE_SERVICE_ROLE_KEY): *account.spec.ts, checkout, orders, error-page, reviews, purchase
const ACCOUNT_SPECS = /(account|checkout|orders|error-page|reviews|purchase)\.spec\.ts$/
// Admin (Phase 7): admin-*.spec.ts, user admin riêng mỗi project. Phải loại khỏi ACCOUNT_SPECS (admin-orders.spec.ts
// khớp cả "orders.spec.ts"). Mobile chỉ chạy smoke.
const ADMIN_SPECS = /admin-[\w-]+\.spec\.ts$/
const ADMIN_MOBILE_SPECS = /admin-smoke\.spec\.ts$/

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Máy dev 4 nhân / 8GB: nhiều worker (mỗi worker một Chromium) chạy cạnh next start làm test phụ thuộc thời
  // điểm hydration chập chờn (⌘K, đổi theme, đổi ngôn ngữ; 3/84 fail với 2 worker). 1 worker: 84/84 qua 2 lần
  // lặp, tổng thời gian không đổi (~1.8 phút) vì build chiếm phần lớn.
  workers: process.env.CI ? undefined : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    // Catalog / layout: không cần tài khoản → chạy được không có SUPABASE_SERVICE_ROLE_KEY
    //   npx playwright test --project=desktop --project=mobile
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: [ACCOUNT_SPECS, ADMIN_SPECS] },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: [ACCOUNT_SPECS, ADMIN_SPECS] },
    // Tài khoản: setup tạo user test (admin API, cần SUPABASE_SERVICE_ROLE_KEY) + đăng nhập sẵn; teardown xóa user
    { name: 'setup', testMatch: /auth\.setup\.ts/, teardown: 'teardown' },
    { name: 'teardown', testMatch: /auth\.teardown\.ts/ },
    {
      name: 'desktop-account',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ACCOUNT_SPECS,
      testIgnore: ADMIN_SPECS,
      dependencies: ['setup'],
    },
    {
      name: 'mobile-account',
      use: { ...devices['Pixel 7'] },
      testMatch: ACCOUNT_SPECS,
      testIgnore: ADMIN_SPECS,
      dependencies: ['setup'],
    },
    // Phiên admin: storageState do từng spec chọn theo tên project (e2e/admin.ts)
    { name: 'desktop-admin', use: { ...devices['Desktop Chrome'] }, testMatch: ADMIN_SPECS, dependencies: ['setup'] },
    { name: 'mobile-admin', use: { ...devices['Pixel 7'] }, testMatch: ADMIN_MOBILE_SPECS, dependencies: ['setup'] },
  ],
  // Chạy trên bản build production: e2e phải phản ánh đúng prerender / cache
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Luôn build + start mới: reuse dễ chạy nhầm trên bản build cũ còn sót ở cổng 3100
    reuseExistingServer: false,
    timeout: 300_000,
    // Cho phép error-page.spec.ts làm hỏng request Supabase bằng cookie (src/lib/supabase/fault-injection.ts)
    env: { E2E_FAULT_INJECTION: '1' },
  },
})
