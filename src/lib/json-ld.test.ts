import { describe, expect, it } from 'vitest'
import { bookJsonLd, serializeJsonLd, websiteJsonLd, type BookJsonLdInput } from './json-ld'

const input: BookJsonLdInput = {
  url: 'https://example.com/sach/sapiens',
  name: 'Sapiens',
  image: 'https://x.supabase.co/storage/v1/object/public/book-covers/a.webp',
  description: 'Mô tả </script><script>alert(1)</script>',
  isbn: '9780062316097',
  authors: ['Yuval Noah Harari'],
  publisher: 'Harper',
  pageCount: 464,
  language: 'en',
  format: 'paperback',
  price: 250_000,
  inStock: true,
  rating: null,
  breadcrumb: [
    { name: 'Sách ngoại văn', url: 'https://example.com/danh-muc/sach-ngoai-van' },
    { name: 'Sapiens', url: 'https://example.com/sach/sapiens' },
  ],
}

describe('serializeJsonLd', () => {
  it('không để lọt </script> ra HTML, parse lại vẫn đúng', () => {
    const json = serializeJsonLd(bookJsonLd(input))
    expect(json).not.toContain('</script>')
    expect(JSON.parse(json)['@graph'][0].description).toBe(input.description)
  })
})

describe('bookJsonLd', () => {
  it('Book + Offer VND, còn hàng / hết hàng', () => {
    const [book] = bookJsonLd(input)['@graph']
    expect(book).toMatchObject({
      '@type': ['Book', 'Product'],
      isbn: '9780062316097',
      author: [{ '@type': 'Person', name: 'Yuval Noah Harari' }],
      offers: { price: 250_000, priceCurrency: 'VND', availability: 'https://schema.org/InStock' },
    })
    expect(bookJsonLd({ ...input, inStock: false })['@graph'][0]).toMatchObject({
      offers: { availability: 'https://schema.org/OutOfStock' },
    })
  })

  it('thiếu field (dữ liệu Google Books bẩn) → bỏ thuộc tính, không ghi null', () => {
    const [book] = bookJsonLd({ ...input, image: null, description: null, isbn: null, publisher: null, pageCount: null, authors: [] })['@graph']
    for (const key of ['image', 'description', 'isbn', 'publisher', 'numberOfPages', 'author', 'aggregateRating']) {
      expect(book).not.toHaveProperty(key)
    }
  })

  it('có đánh giá → aggregateRating; breadcrumb đánh số từ 1', () => {
    const [book, breadcrumb] = bookJsonLd({ ...input, rating: { value: 4.5, count: 2 } })['@graph']
    expect(book).toMatchObject({ aggregateRating: { ratingValue: 4.5, reviewCount: 2 } })
    expect(breadcrumb).toMatchObject({ itemListElement: [{ position: 1 }, { position: 2, item: input.url }] })
  })
})

describe('websiteJsonLd', () => {
  it('SearchAction trỏ trang tìm kiếm', () => {
    expect(websiteJsonLd({ name: 'Nhà Sách Mây', url: 'https://example.com/', searchUrl: 'https://example.com/tim-kiem' }))
      .toMatchObject({ potentialAction: { target: { urlTemplate: 'https://example.com/tim-kiem?q={search_term_string}' } } })
  })
})
