/**
 * fetch cho client Supabase public (catalog): timeout + retry có backoff khi lỗi mạng / timeout / 5xx. 4xx không retry
 * (lỗi của chính request). Hết lượt vẫn lỗi → ném lỗi / trả response 5xx cuối: query catalog `throw` khi có `error`,
 * nên build fail rõ ràng thay vì prerender ra trang rỗng.
 *
 * Hai chế độ:
 * - build (`next build`, prerender 700+ trang): một request treo từng làm cả build fail → chờ lâu, thử nhiều lần.
 *   Tổng tối đa ~33 giây, dưới giới hạn ~50 giây Next cho mỗi `"use cache"` khi prerender.
 * - chạy thật (request của khách): khách không phải chờ lâu khi Supabase chậm → timeout ngắn, retry một lần.
 */
export type RetryPolicy = { timeoutMs: number; attempts: number; backoffMs: readonly number[] }

export const BUILD_POLICY: RetryPolicy = { timeoutMs: 10_000, attempts: 3, backoffMs: [1_000, 2_000] }
export const RUNTIME_POLICY: RetryPolicy = { timeoutMs: 5_000, attempts: 2, backoffMs: [300] }

/** `next build` đặt NEXT_PHASE cho tiến trình build và các worker prerender */
export function retryPolicy(env: Record<string, string | undefined> = process.env): RetryPolicy {
  return env.NEXT_PHASE === 'phase-production-build' ? BUILD_POLICY : RUNTIME_POLICY
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function createResilientFetch(
  policy: RetryPolicy,
  { fetchImpl = fetch, sleep = wait }: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<unknown> } = {},
): typeof fetch {
  return async (input, init) => {
    let lastError: unknown
    for (let attempt = 1; attempt <= policy.attempts; attempt++) {
      const timeout = AbortSignal.timeout(policy.timeoutMs)
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
      try {
        const response = await fetchImpl(input, { ...init, signal })
        if (response.status < 500 || attempt === policy.attempts) return response
        lastError = new Error(`HTTP ${response.status}`)
      } catch (error) {
        // Người gọi tự hủy (không phải timeout của mình): không thử lại
        if (init?.signal?.aborted) throw error
        lastError = error
      }
      if (attempt < policy.attempts) await sleep(policy.backoffMs[attempt - 1] ?? policy.backoffMs.at(-1) ?? 0)
    }
    const reason = lastError instanceof Error ? lastError.message : String(lastError)
    throw new Error(`Supabase không phản hồi sau ${policy.attempts} lần thử (${reason})`, { cause: lastError })
  }
}
