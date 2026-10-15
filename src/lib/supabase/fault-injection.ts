import 'server-only'

/**
 * Chỉ cho e2e: giả lập Supabase chập chờn để kiểm tra trang lỗi. Playwright không chặn được request từ server Next
 * tới Supabase, nên server tự làm hỏng request khi được bật.
 * - Bật khi server chạy với E2E_FAULT_INJECTION=1 (playwright.config.ts → webServer.env). Production không đặt biến
 *   này → hàm luôn trả undefined, cookie không có tác dụng.
 * - Request có cookie `e2e-fault=rest`: mọi request REST (/rest/v1/) của client theo phiên ném lỗi mạng như khi mất
 *   kết nối. Auth (/auth/v1/) không bị chặn: phiên vẫn đọc được, giống sự cố thật (đã đăng nhập, query hỏng).
 */
export const FAULT_COOKIE = 'e2e-fault'

export function faultInjectedFetch(cookieValue: string | undefined): typeof fetch | undefined {
  if (process.env.E2E_FAULT_INJECTION !== '1' || cookieValue !== 'rest') return undefined
  return (input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    if (new URL(url).pathname.startsWith('/rest/v1/')) {
      return Promise.reject(new TypeError('fetch failed (e2e fault injection)'))
    }
    return fetch(input, init)
  }
}
