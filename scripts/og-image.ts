/**
 * Ảnh OG mặc định (1200×630) cho mọi trang không có ảnh riêng (trang sách dùng bìa sách):
 *   npx tsx scripts/og-image.ts  → src/app/[locale]/opengraph-image.png (commit ảnh, không chạy lúc build)
 *
 * Vẽ SVG bằng sharp (có sẵn theo Next), font hệ thống Windows có đủ dấu tiếng Việt (Cambria, Segoe UI): chạy trên máy
 * dev Windows. Màu lấy theo token dark của design system (globals.css), chép tay vì đây là ảnh tĩnh.
 */
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const COLORS = { background: '#0b0b0c', foreground: '#ededed', muted: '#a3a3a3', primary: '#f2b66d' }
const OUT = fileURLToPath(new URL('../src/app/[locale]/opengraph-image.png', import.meta.url))

// Logo: cùng hình với src/app/icon.svg (đám mây trên cuốn sách mở), phóng to
const logo = `<g transform="translate(96 150) scale(4)" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12.5 10h7.25a2.75 2.75 0 0 0 .4-5.47 3.75 3.75 0 0 0-7.05 1.1A2.2 2.2 0 0 0 12.5 10Z"/>
  <path d="M16 15c-2.6-1.9-6.2-2.4-10-1.6v13c3.8-.8 7.4-.3 10 1.6 2.6-1.9 6.2-2.4 10-1.6v-13c-3.8-.8-7.4-.3-10 1.6Z"/>
  <path d="M16 15v13"/>
</g>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${COLORS.background}"/>
  ${logo}
  <text x="96" y="380" font-family="Cambria" font-size="96" font-weight="600" fill="${COLORS.foreground}">Nhà Sách Mây</text>
  <text x="96" y="450" font-family="Segoe UI" font-size="36" fill="${COLORS.muted}">Sách hay cho những giờ đọc yên tĩnh</text>
  <text x="96" y="500" font-family="Segoe UI" font-size="28" fill="${COLORS.muted}">Good books for quiet reading hours</text>
  <rect x="96" y="540" width="120" height="4" rx="2" fill="${COLORS.primary}"/>
</svg>`

sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(OUT)
  .then(() => console.log(`→ ${OUT}`))
