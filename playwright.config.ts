import { defineConfig, devices } from '@playwright/test'
import { E2E_CHAT_QUOTA_TOKEN, loadLocalSupabase } from './scripts/e2e-env'

// e2e chỉ chạy trên Supabase local (npx supabase start): khóa lấy từ `supabase status`, từ chối production / host cloud.
// Chạy ở main process lẫn từng worker (Playwright nạp lại config) → mọi process đều trỏ cùng DB local.
const supabase = loadLocalSupabase()

const PORT = 3100
// Spec cần user e2e (admin API): *account.spec.ts, checkout, orders, error-page, reviews, purchase,
// crawl (dò lỗi chỉ đọc, dùng cả phiên user lẫn phiên admin của setup), auth-email (thư thật qua Mailpit, tự tạo user;
// phải chạy sau setup vì setup xóa mọi user e2e). Spec tạo dữ liệu e2e-admin-… cũng phải nằm ở đây (hoặc admin-*) dù
// không cần user (VD hidden-category-account.spec.ts): setup / teardown xóa mọi dữ liệu e2e-admin, project chạy sau
// setup và teardown chờ project xong.
const ACCOUNT_SPECS = /(account|checkout|orders|error-page|reviews|purchase|crawl|auth-email)\.spec\.ts$/
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
    // Catalog / layout: không cần tài khoản
    //   npx playwright test --project=desktop --project=mobile
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: [ACCOUNT_SPECS, ADMIN_SPECS] },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: [ACCOUNT_SPECS, ADMIN_SPECS] },
    // Tài khoản: setup tạo user test (admin API) + đăng nhập sẵn; teardown xóa user
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
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabase.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
      // Next chỉ điền từ .env.local (máy dev, production) biến chưa có → đặt rỗng để không gửi email thật, VietQR
      // luôn là demo, link tuyệt đối theo localhost: local giống CI
      SITE_URL: '',
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
      VIETQR_BANK_BIN: '',
      VIETQR_BANK_NAME: '',
      VIETQR_ACCOUNT_NO: '',
      VIETQR_ACCOUNT_NAME: '',
      GOOGLE_BOOKS_API_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      // Cho phép error-page.spec.ts làm hỏng request Supabase bằng cookie (src/lib/supabase/fault-injection.ts)
      E2E_FAULT_INJECTION: '1',
      // Chatbot Mây: AI giả (không bao giờ gọi Gemini thật; env.ts chỉ bật mock với Supabase local, ngoài Vercel),
      // key Gemini để trống, token bộ đếm cố định (e2e-seed.ts đặt vào DB local)
      CHAT_AI_MOCK: '1',
      GEMINI_API_KEY: '',
      GEMINI_MODEL: '',
      CHAT_QUOTA_TOKEN: E2E_CHAT_QUOTA_TOKEN,
    },
  },
})
