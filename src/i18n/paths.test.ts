import { describe, expect, it } from 'vitest'
import { localizedPath, localizedSlugPath, matchOrderPath, matchSlugPath } from './paths'

describe('localizedPath', () => {
  it('vi không prefix, en có /en, pathname đã dịch', () => {
    expect(localizedPath('/login', 'vi')).toBe('/dang-nhap')
    expect(localizedPath('/login', 'en')).toBe('/en/login')
    expect(localizedPath('/account/addresses', 'vi')).toBe('/tai-khoan/dia-chi')
    expect(localizedPath('/', 'vi')).toBe('/')
    expect(localizedPath('/', 'en')).toBe('/en')
  })

  it('mã hóa query', () => {
    expect(localizedPath('/login', 'vi', { next: '/tai-khoan?x=1' })).toBe('/dang-nhap?next=%2Ftai-khoan%3Fx%3D1')
  })
})

describe('localizedSlugPath', () => {
  it('trang có slug theo locale', () => {
    expect(localizedSlugPath('/books/[slug]', 'sapiens', 'vi')).toBe('/sach/sapiens')
    expect(localizedSlugPath('/books/[slug]', 'sapiens', 'en')).toBe('/en/books/sapiens')
    expect(localizedSlugPath('/categories/[slug]', 'van-hoc', 'vi')).toBe('/danh-muc/van-hoc')
    expect(localizedSlugPath('/authors/[slug]', 'to-hoai', 'en')).toBe('/en/authors/to-hoai')
  })
})

describe('matchSlugPath', () => {
  it('khớp trang sách / danh mục / tác giả ở cả hai locale', () => {
    expect(matchSlugPath('/sach/sapiens')).toEqual({ kind: '/books/[slug]', slug: 'sapiens', locale: 'vi' })
    expect(matchSlugPath('/en/books/sapiens')).toEqual({ kind: '/books/[slug]', slug: 'sapiens', locale: 'en' })
    expect(matchSlugPath('/danh-muc/van-hoc')).toEqual({ kind: '/categories/[slug]', slug: 'van-hoc', locale: 'vi' })
    expect(matchSlugPath('/en/authors/to-hoai')).toEqual({ kind: '/authors/[slug]', slug: 'to-hoai', locale: 'en' })
  })

  it('không khớp trang tất cả sách, đường dẫn sâu hơn, trang khác', () => {
    expect(matchSlugPath('/sach')).toBeNull()
    expect(matchSlugPath('/sach/')).toBeNull()
    expect(matchSlugPath('/en/books')).toBeNull()
    expect(matchSlugPath('/sach/a/b')).toBeNull()
    expect(matchSlugPath('/tim-kiem')).toBeNull()
    expect(matchSlugPath('/')).toBeNull()
  })

  it('giải mã %; chuỗi % hỏng → null', () => {
    expect(matchSlugPath('/sach/s%C3%A1ch')?.slug).toBe('sách')
    expect(matchSlugPath('/sach/%E0%A4%A')).toBeNull()
  })
})

describe('matchOrderPath', () => {
  it('đặt hàng thành công + chi tiết đơn ở cả hai locale', () => {
    expect(matchOrderPath('/thanh-toan/thanh-cong/NS26101700001')).toEqual({ code: 'NS26101700001', locale: 'vi' })
    expect(matchOrderPath('/en/checkout/success/NS26101700001')).toEqual({ code: 'NS26101700001', locale: 'en' })
    expect(matchOrderPath('/tai-khoan/don-hang/NS26101700001')).toEqual({ code: 'NS26101700001', locale: 'vi' })
    expect(matchOrderPath('/en/account/orders/NS26101700001')).toEqual({ code: 'NS26101700001', locale: 'en' })
  })

  it('không khớp danh sách đơn, thanh toán, đường dẫn sâu hơn', () => {
    expect(matchOrderPath('/tai-khoan/don-hang')).toBeNull()
    expect(matchOrderPath('/thanh-toan')).toBeNull()
    expect(matchOrderPath('/tai-khoan/don-hang/a/b')).toBeNull()
  })
})
