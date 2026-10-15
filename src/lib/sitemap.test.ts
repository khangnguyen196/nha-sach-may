import { describe, expect, it } from 'vitest'
import { sitemapEntries } from './sitemap'

const entries = sitemapEntries('https://example.com', {
  categories: [{ slug: 'van-hoc' }],
  books: [{ slug: 'sapiens', updated_at: '2026-10-15T00:00:00Z' }],
  authors: ['to-hoai'],
})

describe('sitemapEntries', () => {
  it('trang công khai, URL tiếng Việt + hreflang hai locale', () => {
    expect(entries.map((entry) => entry.url)).toEqual([
      'https://example.com/',
      'https://example.com/sach',
      'https://example.com/danh-muc/van-hoc',
      'https://example.com/sach/sapiens',
      'https://example.com/tac-gia/to-hoai',
    ])
    expect(entries[3]).toEqual({
      url: 'https://example.com/sach/sapiens',
      lastModified: '2026-10-15T00:00:00Z',
      alternates: {
        languages: { vi: 'https://example.com/sach/sapiens', en: 'https://example.com/en/books/sapiens' },
      },
    })
    expect(entries[0]?.alternates?.languages).toEqual({ vi: 'https://example.com/', en: 'https://example.com/en' })
  })

  it('không có trang riêng tư / tìm kiếm', () => {
    for (const entry of entries) expect(entry.url).not.toMatch(/tai-khoan|gio-hang|thanh-toan|tim-kiem|admin/)
  })
})
