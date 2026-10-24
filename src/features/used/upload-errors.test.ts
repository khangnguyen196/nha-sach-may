import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadFailure } from './upload-errors'

// Hình dạng lỗi của storage-js 2.x (node_modules/@supabase/storage-js/src/lib/common/errors.ts, fetch.ts):
// StorageApiError(message của body, status HTTP, statusCode = body.statusCode || body.code || status) và
// StorageUnknownError (fetch ném lỗi: không có status / statusCode).

afterEach(() => {
  vi.restoreAllMocks()
})

const code = (error: Parameters<typeof uploadFailure>[0]) => uploadFailure(error).code

describe('uploadFailure: lỗi tải ảnh tin → mã của form', () => {
  it('policy của bucket chặn (row-level security) → LISTING_PHOTO_LIMIT, theo message dù status nào', () => {
    expect(code({ message: 'new row violates row-level security policy', status: 400, statusCode: '403' })).toBe(
      'LISTING_PHOTO_LIMIT',
    )
    expect(code({ message: 'new row violates row-level security policy', status: 403, statusCode: '403' })).toBe(
      'LISTING_PHOTO_LIMIT',
    )
    expect(code({ message: 'New row violates Row-Level Security policy for table "objects"', status: 400 })).toBe(
      'LISTING_PHOTO_LIMIT',
    )
  })

  it('JWT hết hạn / không hợp lệ (400 hoặc 403) → SESSION_EXPIRED', () => {
    expect(code({ message: 'jwt expired', status: 400, statusCode: '403' })).toBe('SESSION_EXPIRED')
    expect(code({ message: 'jwt expired', status: 403, statusCode: 'InvalidJWT' })).toBe('SESSION_EXPIRED')
    expect(code({ message: '"exp" claim timestamp check failed', status: 400, statusCode: '400' })).toBe(
      'SESSION_EXPIRED',
    )
    expect(code({ message: 'Unauthorized', status: 403, statusCode: '403' })).toBe('SESSION_EXPIRED')
    expect(code({ message: 'invalid JWT: unable to parse or verify signature', status: 400, statusCode: '403' })).toBe(
      'SESSION_EXPIRED',
    )
  })

  it('không tới được máy chủ (không có status, statusCode) → NETWORK_ERROR', () => {
    expect(code({ message: 'fetch failed' })).toBe('NETWORK_ERROR')
    expect(code({ message: 'TypeError: Failed to fetch', status: undefined, statusCode: undefined })).toBe(
      'NETWORK_ERROR',
    )
  })

  it('còn lại → UNKNOWN, log chỉ status / statusCode (không log message)', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const secret = 'payload too large: 6a1f…/b2c3….webp'
    expect(code({ message: secret, status: 413, statusCode: '413' })).toBe('UNKNOWN')
    expect(code({ message: 'Internal Server Error', status: 500, statusCode: '500' })).toBe('UNKNOWN')
    // 401 / 500 có chữ "jwt" vẫn không phải phiên hết hạn theo quy ước (chỉ 400 / 403)
    expect(code({ message: 'jwt malformed', status: 500, statusCode: '500' })).toBe('UNKNOWN')
    // 400 không nói gì về JWT (VD mimetype / tên sai) → UNKNOWN
    expect(code({ message: 'mime type image/png is not supported', status: 400, statusCode: '415' })).toBe('UNKNOWN')
    expect(log).toHaveBeenCalledTimes(4)
    for (const args of log.mock.calls) expect(args.join(' ')).not.toContain('webp')
    expect(log.mock.calls[0]).toEqual(['uploadListingPhoto:', 413, '413'])
  })
})
