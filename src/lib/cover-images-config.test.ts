import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { coverImagesConfig } from './cover-images-config'

const PRODUCTION = 'https://ylfgwcxddxvfxwldmwtf.supabase.co'
const LOCAL_PATTERN = /^(127\.0\.0\.1|localhost)$/

describe('coverImagesConfig', () => {
  it('build production (Vercel): chỉ host Storage của project qua https, không IP local', () => {
    const config = coverImagesConfig(PRODUCTION, { vercel: true })
    expect(config.dangerouslyAllowLocalIP).toBe(false)
    expect(config.remotePatterns).toEqual([
      {
        protocol: 'https',
        hostname: 'ylfgwcxddxvfxwldmwtf.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/book-covers/**',
        search: '',
      },
    ])
    for (const pattern of config.remotePatterns ?? []) expect(pattern.hostname).not.toMatch(LOCAL_PATTERN)
  })

  it('build trên Vercel với URL Supabase local → lỗi build (chống SSRF qua /_next/image)', () => {
    expect(() => coverImagesConfig('http://127.0.0.1:54321', { vercel: true })).toThrow(/Vercel/)
    expect(() => coverImagesConfig('http://localhost:54321', { vercel: true })).toThrow(/Vercel/)
  })

  it('URL cloud không https → lỗi', () => {
    expect(() => coverImagesConfig('http://ylfgwcxddxvfxwldmwtf.supabase.co', { vercel: false })).toThrow(/https/)
  })

  it('build e2e (Supabase local, ngoài Vercel): http + cổng + cho phép IP local', () => {
    const config = coverImagesConfig('http://127.0.0.1:54321', { vercel: false })
    expect(config.dangerouslyAllowLocalIP).toBe(true)
    expect(config.remotePatterns).toEqual([
      expect.objectContaining({ protocol: 'http', hostname: '127.0.0.1', port: '54321' }),
    ])
  })

  it('next.config.ts dùng coverImagesConfig với cờ VERCEL, không tự khai remotePatterns / dangerouslyAllowLocalIP', () => {
    const source = readFileSync(join(import.meta.dirname, '../../next.config.ts'), 'utf8')
    expect(source).toContain("...coverImagesConfig(supabaseUrl, { vercel: process.env.VERCEL === '1' })")
    expect(source).not.toMatch(/remotePatterns|dangerouslyAllowLocalIP/)
  })
})
