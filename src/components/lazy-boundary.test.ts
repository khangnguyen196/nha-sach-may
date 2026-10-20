import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LazyBoundary } from './lazy-boundary'

// Không có DOM trong Vitest (environment node) và error boundary không chạy khi render ở server → kiểm đúng hai bước
// React làm khi phần con ném lỗi: getDerivedStateFromError, rồi render() với state đó.
const props = {
  labels: { message: 'Không tải được phần này.', reload: 'Tải lại trang', close: 'Đóng' },
  onDismiss: () => {},
  children: createElement('p', null, 'nội dung tải lười'),
}

describe('LazyBoundary', () => {
  it('chưa lỗi: render phần con (trong Suspense), không có khối lỗi', () => {
    const html = renderToStaticMarkup(createElement(LazyBoundary, props))
    expect(html).toContain('nội dung tải lười')
    expect(html).not.toContain('lazy-error')
  })

  it('phần con ném lỗi (chunk tải lỗi) → khối báo + nút "Tải lại trang", không render lại phần con', () => {
    const boundary = new LazyBoundary(props)
    boundary.state = LazyBoundary.getDerivedStateFromError()
    const html = renderToStaticMarkup(boundary.render())
    expect(html).toContain('role="alert"')
    expect(html).toContain('data-testid="lazy-error"')
    expect(html).toContain('Không tải được phần này.')
    expect(html).toContain('>Tải lại trang</button>')
    expect(html).toContain('>Đóng</button>')
    expect(html).not.toContain('nội dung tải lười')
  })
})
