import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { LISTING_PHOTO_MAX_BYTES, LISTING_PHOTO_MAX_SIDE, toListingPhotoWebp } = await import('./photos')

/** Ảnh ngang 300×200: nửa trái đỏ, nửa phải xanh (để biết đã xoay đúng chiều chưa) */
async function halves(width = 300, height = 200) {
  const left = await sharp({ create: { width: width / 2, height, channels: 3, background: '#ff0000' } })
    .png()
    .toBuffer()
  return sharp({ create: { width, height, channels: 3, background: '#0000ff' } })
    .composite([{ input: left, left: 0, top: 0 }])
    .png()
    .toBuffer()
}

/** JPEG như ảnh chụp điện thoại: EXIF orientation 6 (xoay 90° theo chiều kim đồng hồ khi hiện) + tọa độ GPS */
async function phoneJpeg(width = 300, height = 200) {
  return sharp(await halves(width, height))
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExifMerge({
      IFD0: { Make: 'E2E' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '21/1 1/1 30/1', GPSLongitudeRef: 'E', GPSLongitude: '105/1 51/1 0/1' },
    })
    .toBuffer()
}

async function pixel(webp: Buffer, x: number, y: number) {
  const { data, info } = await sharp(webp).raw().toBuffer({ resolveWithObject: true })
  const at = (y * info.width + x) * info.channels
  return [data[at], data[at + 1], data[at + 2]]
}

const isRed = ([r, g, b]: (number | undefined)[]) => (r ?? 0) > 200 && (g ?? 255) < 60 && (b ?? 255) < 60
const isBlue = ([r, g, b]: (number | undefined)[]) => (r ?? 255) < 60 && (g ?? 255) < 60 && (b ?? 0) > 200

describe('toListingPhotoWebp', () => {
  it('ảnh điện thoại có EXIF GPS + orientation 6 → WebP không EXIF, đã xoay đúng chiều', async () => {
    const input = await phoneJpeg()
    const before = await sharp(input).metadata()
    // Ảnh mẫu có thật EXIF orientation + GPS (con trỏ GPS IFD, tag 0x8825)
    expect(before.orientation).toBe(6)
    expect(before.exif?.includes(Buffer.from([0x88, 0x25])) || before.exif?.includes(Buffer.from([0x25, 0x88]))).toBe(true)

    const webp = await toListingPhotoWebp(input)
    expect(webp).not.toBeNull()
    if (!webp) return
    const after = await sharp(webp).metadata()
    expect(after.format).toBe('webp')
    expect(after.exif).toBeUndefined()
    expect(after.xmp).toBeUndefined()
    expect(after.orientation).toBeUndefined()
    // Xoay 90° theo chiều kim đồng hồ: ảnh dọc, nửa trái (đỏ) lên trên, nửa phải (xanh) xuống dưới
    expect([after.width, after.height]).toEqual([200, 300])
    expect(isRed(await pixel(webp, 100, 10))).toBe(true)
    expect(isBlue(await pixel(webp, 100, 290))).toBe(true)
    expect(webp.length).toBeLessThanOrEqual(LISTING_PHOTO_MAX_BYTES)
  })

  it('ảnh lớn → cạnh dài 1200px, giữ tỉ lệ; ảnh nhỏ không phóng to', async () => {
    const large = await toListingPhotoWebp(await sharp(await halves(3000, 2000)).jpeg().toBuffer())
    const small = await toListingPhotoWebp(await sharp(await halves(400, 300)).png().toBuffer())
    expect(large && (await sharp(large).metadata())).toMatchObject({ width: LISTING_PHOTO_MAX_SIDE, height: 800 })
    expect(small && (await sharp(small).metadata())).toMatchObject({ width: 400, height: 300 })
    // Ảnh dọc (xoay theo EXIF): cạnh dài là chiều cao
    const portrait = await toListingPhotoWebp(await phoneJpeg(3000, 2000))
    expect(portrait && (await sharp(portrait).metadata())).toMatchObject({ width: 800, height: LISTING_PHOTO_MAX_SIDE })
    expect(large?.length).toBeLessThanOrEqual(LISTING_PHOTO_MAX_BYTES)
  })

  it('WebP vào cũng được nén lại (không giữ nguyên file người dùng gửi)', async () => {
    const input = await sharp(await halves(2400, 1600)).webp({ quality: 100 }).toBuffer()
    const webp = await toListingPhotoWebp(input)
    expect(webp && (await sharp(webp).metadata())).toMatchObject({ format: 'webp', width: LISTING_PHOTO_MAX_SIDE })
  })

  it('quá cỡ thì hạ chất lượng tới khi vừa, vẫn quá → null', async () => {
    // Ảnh nhiễu: khó nén, mỗi mức chất lượng ra một cỡ khác
    const noise = Buffer.alloc(800 * 600 * 3)
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) % 251
    const input = await sharp(noise, { raw: { width: 800, height: 600, channels: 3 } }).png().toBuffer()
    const best = await toListingPhotoWebp(input)
    expect(best).not.toBeNull()
    const limit = Math.floor((best?.length ?? 0) * 0.8)
    const smaller = await toListingPhotoWebp(input, { maxBytes: limit })
    expect(smaller).not.toBeNull()
    expect(smaller?.length).toBeLessThanOrEqual(limit)
    expect(await toListingPhotoWebp(input, { maxBytes: 100 })).toBeNull()
  })

  it('không phải ảnh, GIF, SVG, AVIF, ảnh hỏng → null', async () => {
    expect(await toListingPhotoWebp(Buffer.from('đây là văn bản, không phải ảnh'))).toBeNull()
    const base = sharp({ create: { width: 60, height: 90, channels: 3, background: '#456' } })
    expect(await toListingPhotoWebp(await base.clone().gif().toBuffer())).toBeNull()
    expect(await toListingPhotoWebp(await base.clone().avif().toBuffer())).toBeNull()
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
    expect(await toListingPhotoWebp(svg)).toBeNull()
    const jpeg = await base.clone().jpeg().toBuffer()
    expect(await toListingPhotoWebp(jpeg.subarray(0, 100))).toBeNull()
  })

  it('quá 40 triệu điểm ảnh → null', async () => {
    const bomb = await sharp({ create: { width: 7000, height: 6000, channels: 3, background: '#456' } })
      .png({ compressionLevel: 9 })
      .toBuffer()
    expect(await toListingPhotoWebp(bomb)).toBeNull()
  }, 30_000)
})
