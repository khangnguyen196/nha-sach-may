import localFont from 'next/font/local'

// Font tự host (src/assets/fonts, giấy phép OFL kèm theo): đúng các file next/font/google từng tải từ Google Fonts, để
// build không phụ thuộc mạng (một lần tải font lỗi từng làm hỏng cache Turbopack, mọi lần build sau đều fail).
//
// Google chia mỗi họ font theo subset (latin, latin-ext, vietnamese), mỗi file có unicode-range riêng; next/font/local
// không gán unicode-range cho từng file nên mỗi subset là một lần gọi, rồi ghép thành chuỗi font-family trong
// globals.css theo thứ tự latin → latin-ext → vietnamese (giống thứ tự trình duyệt chọn trong CSS của Google).
// Chỉ preload latin + vietnamese như trước; latin-ext chỉ tải khi trang có ký tự của nó. Fallback đã chỉnh số đo
// (giảm CLS) khai báo tay trong globals.css với đúng số đo next/font/google dùng: next/font/local tự tính từ file
// subset ra số khác (size-adjust 100% thay vì 110.36%).
// next/font bắt cấu hình là literal viết thẳng → unicode-range lặp lại ở từng lần gọi.

const beVietnamProLatin = localFont({
  src: [
    { path: '../assets/fonts/be-vietnam-pro-400-latin.woff2', weight: '400', style: 'normal' },
    { path: '../assets/fonts/be-vietnam-pro-500-latin.woff2', weight: '500', style: 'normal' },
    { path: '../assets/fonts/be-vietnam-pro-600-latin.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
  adjustFontFallback: false,
  variable: '--font-be-vietnam-pro-latin',
})

const beVietnamProLatinExt = localFont({
  src: [
    { path: '../assets/fonts/be-vietnam-pro-400-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: '../assets/fonts/be-vietnam-pro-500-latin-ext.woff2', weight: '500', style: 'normal' },
    { path: '../assets/fonts/be-vietnam-pro-600-latin-ext.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
    },
  ],
  preload: false,
  adjustFontFallback: false,
  variable: '--font-be-vietnam-pro-latin-ext',
})

const beVietnamProVietnamese = localFont({
  src: [
    { path: '../assets/fonts/be-vietnam-pro-400-vietnamese.woff2', weight: '400', style: 'normal' },
    { path: '../assets/fonts/be-vietnam-pro-500-vietnamese.woff2', weight: '500', style: 'normal' },
    { path: '../assets/fonts/be-vietnam-pro-600-vietnamese.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
    },
  ],
  adjustFontFallback: false,
  variable: '--font-be-vietnam-pro-vietnamese',
})

// Lora là variable font: một file / subset cho cả 500 và 600
const loraLatin = localFont({
  src: [{ path: '../assets/fonts/lora-500-600-latin.woff2', weight: '500 600', style: 'normal' }],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
  adjustFontFallback: false,
  variable: '--font-lora-latin',
})

const loraLatinExt = localFont({
  src: [{ path: '../assets/fonts/lora-500-600-latin-ext.woff2', weight: '500 600', style: 'normal' }],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
    },
  ],
  preload: false,
  adjustFontFallback: false,
  variable: '--font-lora-latin-ext',
})

const loraVietnamese = localFont({
  src: [{ path: '../assets/fonts/lora-500-600-vietnamese.woff2', weight: '500 600', style: 'normal' }],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
    },
  ],
  adjustFontFallback: false,
  variable: '--font-lora-vietnamese',
})

export const fontVariables = [
  beVietnamProLatin,
  beVietnamProLatinExt,
  beVietnamProVietnamese,
  loraLatin,
  loraLatinExt,
  loraVietnamese,
]
  .map((font) => font.variable)
  .join(' ')
