import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { faultInjectedFetch } = await import('./fault-injection')

const REST = 'https://example.supabase.co/rest/v1/orders?select=id'
const AUTH = 'https://example.supabase.co/auth/v1/.well-known/jwks.json'

describe('faultInjectedFetch', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('tắt khi không có E2E_FAULT_INJECTION=1', () => {
    vi.stubEnv('E2E_FAULT_INJECTION', '')
    expect(faultInjectedFetch('rest')).toBeUndefined()
  })

  it('tắt khi không có cookie đúng giá trị', () => {
    vi.stubEnv('E2E_FAULT_INJECTION', '1')
    expect(faultInjectedFetch(undefined)).toBeUndefined()
    expect(faultInjectedFetch('auth')).toBeUndefined()
  })

  it('production của Vercel luôn tắt, kể cả khi E2E_FAULT_INJECTION=1', () => {
    vi.stubEnv('E2E_FAULT_INJECTION', '1')
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(faultInjectedFetch('rest')).toBeUndefined()
  })

  it('bật (e2e, preview): request REST ném lỗi mạng, auth đi qua', async () => {
    vi.stubEnv('E2E_FAULT_INJECTION', '1')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const realFetch = vi.fn(async () => new Response('ok'))
    vi.stubGlobal('fetch', realFetch)

    const faulty = faultInjectedFetch('rest')
    expect(faulty).toBeDefined()
    await expect(faulty?.(REST)).rejects.toThrow(TypeError)
    await expect(faulty?.(new Request(REST))).rejects.toThrow('fetch failed')
    await expect(faulty?.(AUTH)).resolves.toBeInstanceOf(Response)
    expect(realFetch).toHaveBeenCalledTimes(1)
  })
})
