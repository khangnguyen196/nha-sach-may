import { defineConfig, devices } from '@playwright/test'

const PORT = 3100

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
    // Tạo user test (admin API, cần SUPABASE_SERVICE_ROLE_KEY trong .env.local) + đăng nhập sẵn; teardown xóa user
    { name: 'setup', testMatch: /auth\.setup\.ts/, teardown: 'teardown' },
    { name: 'teardown', testMatch: /auth\.teardown\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
  ],
  // Chạy trên bản build production: e2e phải phản ánh đúng prerender / cache
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Luôn build + start mới: reuse dễ chạy nhầm trên bản build cũ còn sót ở cổng 3100
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
