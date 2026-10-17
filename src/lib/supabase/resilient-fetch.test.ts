import { describe, expect, it, vi } from 'vitest'
import { BUILD_POLICY, createResilientFetch, retryPolicy, RUNTIME_POLICY, type RetryPolicy } from './resilient-fetch'

const ok = () => new Response('[]', { status: 200 })
const status = (code: number) => new Response('', { status: code })

function setup(policy: RetryPolicy, results: (Response | Error)[]) {
  const fetchImpl = vi.fn<typeof fetch>(async () => {
    const next = results.shift()
    if (!next) throw new Error('hết kết quả giả')
    if (next instanceof Error) throw next
    return next
  })
  const sleep = vi.fn(async () => undefined)
  return { run: createResilientFetch(policy, { fetchImpl, sleep }), fetchImpl, sleep }
}

describe('retryPolicy', () => {
  it('next build → chế độ build (10 giây × 3 lần); còn lại → chế độ chạy thật (5 giây, retry 1 lần)', () => {
    expect(retryPolicy({ NEXT_PHASE: 'phase-production-build' })).toBe(BUILD_POLICY)
    expect(retryPolicy({ NEXT_PHASE: 'phase-production-server' })).toBe(RUNTIME_POLICY)
    expect(retryPolicy({})).toBe(RUNTIME_POLICY)
    expect(BUILD_POLICY).toMatchObject({ timeoutMs: 10_000, attempts: 3 })
    expect(RUNTIME_POLICY).toMatchObject({ timeoutMs: 5_000, attempts: 2 })
  })

  it('chế độ build: tổng thời gian chờ tối đa dưới ~50 giây của "use cache" khi prerender', () => {
    const backoff = BUILD_POLICY.backoffMs.reduce((sum, ms) => sum + ms, 0)
    expect(BUILD_POLICY.timeoutMs * BUILD_POLICY.attempts + backoff).toBeLessThan(45_000)
  })
})

describe.each([
  ['build', BUILD_POLICY],
  ['chạy thật', RUNTIME_POLICY],
])('createResilientFetch (%s)', (_name, policy) => {
  it('thành công ngay → một request', async () => {
    const { run, fetchImpl } = setup(policy, [ok()])
    expect((await run('https://x.supabase.co/rest/v1/books')).status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('lỗi mạng rồi thành công → retry, có chờ backoff', async () => {
    const { run, fetchImpl, sleep } = setup(policy, [new TypeError('fetch failed'), ok()])
    expect((await run('https://x.supabase.co/rest/v1/books')).status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(policy.backoffMs[0])
  })

  it('5xx → retry; hết lượt vẫn 5xx → trả response cuối (query báo lỗi, không ra dữ liệu rỗng)', async () => {
    const { run, fetchImpl } = setup(policy, Array.from({ length: policy.attempts }, () => status(503)))
    expect((await run('https://x.supabase.co/rest/v1/books')).status).toBe(503)
    expect(fetchImpl).toHaveBeenCalledTimes(policy.attempts)
  })

  it('4xx không retry', async () => {
    const { run, fetchImpl } = setup(policy, [status(404)])
    expect((await run('https://x.supabase.co/rest/v1/books')).status).toBe(404)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('lỗi mạng / timeout mọi lượt → ném lỗi rõ ràng sau đúng số lần thử', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    const { run, fetchImpl } = setup(policy, Array.from({ length: policy.attempts }, () => timeout))
    await expect(run('https://x.supabase.co/rest/v1/books')).rejects.toThrow(
      `Supabase không phản hồi sau ${policy.attempts} lần thử`,
    )
    expect(fetchImpl).toHaveBeenCalledTimes(policy.attempts)
  })

  it('mỗi lượt có signal timeout đúng thời hạn của chế độ', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
    try {
      const { run } = setup(policy, [new TypeError('fetch failed'), ok()])
      await run('https://x.supabase.co/rest/v1/books')
      expect(timeoutSpy.mock.calls).toEqual([[policy.timeoutMs], [policy.timeoutMs]])
    } finally {
      timeoutSpy.mockRestore()
    }
  })

  it('request treo quá thời hạn → hủy và thử lại (thời hạn ngắn, chạy thật)', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))),
    )
    const run = createResilientFetch({ ...policy, timeoutMs: 20, backoffMs: [0] }, { fetchImpl })
    await expect(run('https://x.supabase.co/rest/v1/books')).rejects.toThrow(`sau ${policy.attempts} lần thử`)
    expect(fetchImpl).toHaveBeenCalledTimes(policy.attempts)
  })

  it('người gọi tự hủy → không retry', async () => {
    const controller = new AbortController()
    controller.abort()
    const { run, fetchImpl } = setup(policy, [new DOMException('aborted', 'AbortError'), ok()])
    await expect(run('https://x.supabase.co/rest/v1/books', { signal: controller.signal })).rejects.toThrow('aborted')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
