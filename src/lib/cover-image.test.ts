import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { COVER_WIDTH, toCoverWebp, type CoverWebp } from './cover-image'

const background = { r: 120, g: 60, b: 20 }

function image(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background } })
}

async function sizeOf(cover: CoverWebp) {
  const { format, width, height } = await sharp(cover.data).metadata()
  // width trả kèm phải khớp file thật (ghi vào books.cover_width)
  expect(cover.width).toBe(width)
  return { format, width, height }
}

describe('toCoverWebp', () => {
  it('JPEG lớn → WebP rộng 600px, giữ tỉ lệ', async () => {
    const webp = await toCoverWebp(await image(1200, 1800).jpeg().toBuffer())
    expect(webp && (await sizeOf(webp))).toEqual({ format: 'webp', width: COVER_WIDTH, height: 900 })
  })

  it('PNG, WebP, AVIF đều nhận', async () => {
    for (const buffer of [
      await image(800, 1200).png().toBuffer(),
      await image(800, 1200).webp().toBuffer(),
      await image(300, 450).avif().toBuffer(),
    ]) {
      const webp = await toCoverWebp(buffer)
      expect(webp && (await sizeOf(webp))?.format).toBe('webp')
    }
  })

  it('ảnh nhỏ không phóng to', async () => {
    const webp = await toCoverWebp(await image(128, 192).jpeg().toBuffer())
    expect(webp && (await sizeOf(webp))).toEqual({ format: 'webp', width: 128, height: 192 })
  })

  it('không phải ảnh, GIF, SVG → null', async () => {
    expect(await toCoverWebp(Buffer.from('đây là văn bản, không phải ảnh'))).toBeNull()
    expect(await toCoverWebp(await image(100, 150).gif().toBuffer())).toBeNull()
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
    expect(await toCoverWebp(svg)).toBeNull()
  })

  it('ảnh hỏng (cắt cụt) → null', async () => {
    const jpeg = await image(600, 900).jpeg().toBuffer()
    expect(await toCoverWebp(jpeg.subarray(0, 200))).toBeNull()
  })

  it('quá 40 triệu điểm ảnh → null', async () => {
    // PNG một màu nén rất nhỏ nhưng giải nén ra 42MP
    const bomb = await image(7000, 6000).png({ compressionLevel: 9 }).toBuffer()
    expect(await toCoverWebp(bomb)).toBeNull()
  }, 30_000)
})
