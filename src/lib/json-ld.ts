/**
 * Dữ liệu có cấu trúc (schema.org, JSON-LD) cho trang sách và trang chủ. Hàm thuần (Vitest); trang render vào
 * `<script type="application/ld+json">` (không phải JS chạy, không tính vào bundle).
 */

/** JSON an toàn trong <script>: `<` → chuỗi thoát \u003c, mô tả sách chứa "</script>" không thoát được ra HTML */
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, String.raw`\u003c`)
}

export type BookJsonLdInput = {
  url: string
  name: string
  image: string | null
  description: string | null
  isbn: string | null
  authors: string[]
  publisher: string | null
  pageCount: number | null
  language: string
  format: 'paperback' | 'hardcover' | 'boxset'
  price: number
  inStock: boolean
  rating: { value: number; count: number } | null
  breadcrumb: { name: string; url: string }[]
}

const FORMATS = { paperback: 'Paperback', hardcover: 'Hardcover', boxset: 'Paperback' } as const
const DESCRIPTION_MAX = 500

export function bookJsonLd(input: BookJsonLdInput) {
  const description = input.description?.slice(0, DESCRIPTION_MAX)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Book', 'Product'],
        name: input.name,
        url: input.url,
        ...(input.image && { image: input.image }),
        ...(description && { description }),
        ...(input.isbn && { isbn: input.isbn }),
        ...(input.authors.length > 0 && { author: input.authors.map((name) => ({ '@type': 'Person', name })) }),
        ...(input.publisher && { publisher: { '@type': 'Organization', name: input.publisher } }),
        ...(input.pageCount && { numberOfPages: input.pageCount }),
        inLanguage: input.language,
        bookFormat: `https://schema.org/${FORMATS[input.format]}`,
        offers: {
          '@type': 'Offer',
          url: input.url,
          price: input.price,
          priceCurrency: 'VND',
          availability: input.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        },
        ...(input.rating &&
          input.rating.count > 0 && {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: input.rating.value,
              reviewCount: input.rating.count,
              bestRating: 5,
              worstRating: 1,
            },
          }),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: input.breadcrumb.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          item: crumb.url,
        })),
      },
    ],
  }
}

/** Trang chủ: tên site + hộp tìm kiếm (Google sitelinks search box) */
export function websiteJsonLd({ name, url, searchUrl }: { name: string; url: string; searchUrl: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${searchUrl}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}
