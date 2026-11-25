import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Nhánh đếm N ở tab Sách mới: lỗi → null (trang vẫn hiện kết quả sách mới), không có sách khớp → 0 mà không đếm.
// Query thật (cache, Supabase) thay bằng hàm giả.

const matchingUsedSearchBookIds = vi.fn<(q: string, visibleIds: number[]) => Promise<number[]>>()
const countUsedListings = vi.fn<(bookIds: number[]) => Promise<number>>()

vi.mock('server-only', () => ({}))
vi.mock('./public-queries', () => ({ matchingUsedSearchBookIds, countUsedListings }))

const { searchUsedCount } = await import('./search-count')

describe('searchUsedCount', () => {
  beforeEach(() => {
    matchingUsedSearchBookIds.mockReset()
    countUsedListings.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('đếm lỗi → null', async () => {
    matchingUsedSearchBookIds.mockResolvedValue([1, 2])
    countUsedListings.mockRejectedValue(new Error('countUsedListings: boom'))
    await expect(searchUsedCount('ky mong', [10])).resolves.toBeNull()
  })

  it('lấy id sách khớp lỗi → null, không đếm', async () => {
    matchingUsedSearchBookIds.mockRejectedValue(new Error('matchingUsedSearchBookIds: boom'))
    await expect(searchUsedCount('ky mong', [10])).resolves.toBeNull()
    expect(countUsedListings).not.toHaveBeenCalled()
  })

  it('log không chứa từ khóa hay message lỗi', async () => {
    matchingUsedSearchBookIds.mockRejectedValue(new Error('matchingUsedSearchBookIds: tu-khoa-bi-mat'))
    await searchUsedCount('tu-khoa-bi-mat', [10])
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ')
    expect(logged).not.toContain('tu-khoa-bi-mat')
  })

  it('không có sách khớp → 0, không gọi countUsedListings', async () => {
    matchingUsedSearchBookIds.mockResolvedValue([])
    await expect(searchUsedCount('ky mong', [10])).resolves.toBe(0)
    expect(countUsedListings).not.toHaveBeenCalled()
  })

  it('bình thường → đúng số tin', async () => {
    matchingUsedSearchBookIds.mockResolvedValue([3, 5])
    countUsedListings.mockResolvedValue(7)
    await expect(searchUsedCount('ky mong', [10])).resolves.toBe(7)
    expect(matchingUsedSearchBookIds).toHaveBeenCalledWith('ky mong', [10])
    expect(countUsedListings).toHaveBeenCalledWith([3, 5])
  })
})
