import { describe, expect, it } from 'vitest'
import { siteUrl } from './site-url'

describe('siteUrl', () => {
  it('SITE_URL trước, bỏ / cuối', () => {
    expect(siteUrl({ SITE_URL: 'https://nhasachmay.vn/', VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' })).toBe(
      'https://nhasachmay.vn',
    )
  })

  it('Vercel: thêm https://', () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'nha-sach-may.vercel.app' })).toBe('https://nha-sach-may.vercel.app')
  })

  it('không có gì → máy dev', () => {
    expect(siteUrl({})).toBe('http://localhost:3000')
    expect(siteUrl({ SITE_URL: '  ' })).toBe('http://localhost:3000')
  })
})
