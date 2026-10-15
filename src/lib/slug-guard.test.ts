import { describe, expect, it, vi } from 'vitest'
import { createSlugGuard, type SlugLoader } from './slug-guard'

function setup(slugs: string[], fresh: string[] = []) {
  let time = 0
  const loader = {
    all: vi.fn<SlugLoader['all']>(async () => slugs),
    one: vi.fn<SlugLoader['one']>(async (_kind, slug) => fresh.includes(slug)),
  }
  const exists = createSlugGuard(loader, () => time)
  return { loader, exists, tick: (ms: number) => (time += ms) }
}

describe('createSlugGuard', () => {
  it('slug có trong danh sách → true, danh sách tải một lần trong 60 giây', async () => {
    const { loader, exists, tick } = setup(['sapiens', 'contact'])
    expect(await exists('/books/[slug]', 'sapiens')).toBe(true)
    tick(30_000)
    expect(await exists('/books/[slug]', 'contact')).toBe(true)
    expect(loader.all).toHaveBeenCalledTimes(1)
    expect(loader.one).not.toHaveBeenCalled()
    tick(31_000)
    await exists('/books/[slug]', 'sapiens')
    expect(loader.all).toHaveBeenCalledTimes(2)
  })

  it('không có trong danh sách → hỏi thẳng (sách vừa tạo vẫn mở được ngay)', async () => {
    const { loader, exists } = setup(['sapiens'], ['sach-moi'])
    expect(await exists('/books/[slug]', 'sach-moi')).toBe(true)
    expect(await exists('/books/[slug]', 'khong-co')).toBe(false)
    expect(loader.one).toHaveBeenCalledTimes(2)
  })

  it('cache riêng từng loại trang', async () => {
    const { loader, exists } = setup(['x'])
    await exists('/books/[slug]', 'x')
    await exists('/authors/[slug]', 'x')
    expect(loader.all).toHaveBeenCalledTimes(2)
  })

  it('lỗi mạng → cho qua (true)', async () => {
    const { loader, exists } = setup([])
    loader.all.mockRejectedValueOnce(new Error('fetch failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await exists('/books/[slug]', 'bat-ky')).toBe(true)
  })
})
