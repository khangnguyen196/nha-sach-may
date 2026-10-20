import { createElement, type ReactNode, type ReactPortal } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LazyBoundary } from './lazy-boundary'

// Không có DOM trong Vitest (environment node) và error boundary không chạy khi render ở server → kiểm đúng hai bước
// React làm khi phần con ném lỗi: getDerivedStateFromError, rồi render() với state đó. Hành vi thật trên trình duyệt
// (chunk bị chặn, focus, Esc, Đóng, Tải lại trang) do e2e `expectLazyChunkError` (e2e/helpers.ts) kiểm.
const props = {
  labels: { message: 'Không tải được phần này.', reload: 'Tải lại trang', close: 'Đóng' },
  onDismiss: () => {},
  onError: () => {},
  children: createElement('p', null, 'nội dung tải lười'),
}

const isPortal = (node: ReactNode): node is ReactPortal & { containerInfo: unknown } =>
  typeof node === 'object' && node !== null && 'containerInfo' in node

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LazyBoundary', () => {
  it('chưa lỗi: render phần con (trong Suspense), không có khối lỗi', () => {
    const html = renderToStaticMarkup(createElement(LazyBoundary, props))
    expect(html).toContain('nội dung tải lười')
    expect(html).not.toContain('lazy-error')
  })

  it('phần con ném lỗi (chunk tải lỗi) → khối báo + nút "Tải lại trang" portal ra body, không render lại phần con', () => {
    // createPortal chỉ cần container có nodeType của Element
    const body = { nodeType: 1 }
    vi.stubGlobal('document', { body })
    const boundary = new LazyBoundary(props)
    boundary.state = LazyBoundary.getDerivedStateFromError(new Error('Failed to load chunk'))
    const portal = boundary.render()
    if (!isPortal(portal)) throw new Error('render() phải trả portal')
    expect(portal.containerInfo).toBe(body)
    const html = renderToStaticMarkup(portal.children)
    expect(html).toContain('role="alert"')
    expect(html).toContain('data-testid="lazy-error"')
    expect(html).toContain('Không tải được phần này.')
    expect(html).toContain('>Tải lại trang</button>')
    expect(html).toContain('>Đóng</button>')
    expect(html).not.toContain('nội dung tải lười')
  })

  it('componentDidCatch báo cha (đóng trạng thái mở), trừ lỗi điều hướng của Next', () => {
    const onError = vi.fn()
    const boundary = new LazyBoundary({ ...props, onError })
    boundary.componentDidCatch(Object.assign(new Error('NEXT_NOT_FOUND'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }))
    expect(onError).not.toHaveBeenCalled()
    boundary.componentDidCatch(new Error('Failed to load chunk'))
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('lỗi điều hướng của Next (digest NEXT_…) → ném tiếp cho boundary của Next', () => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/x;307;' })
    const boundary = new LazyBoundary(props)
    boundary.state = LazyBoundary.getDerivedStateFromError(redirect)
    expect(() => boundary.render()).toThrow(redirect)
  })
})
