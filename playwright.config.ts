import { defineConfig, devices } from '@playwright/test'

const PORT = 3100

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
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
