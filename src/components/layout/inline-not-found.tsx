import type { ComponentProps } from 'react'
import type { NotFoundKind } from '@/lib/not-found-kind'
import { NotFoundView } from './not-found-view'

type Props = { kind: NotFoundKind } & Pick<ComponentProps<typeof NotFoundView>, 'heading' | 'primary'>

/**
 * UI 404 trong một boundary đã stream, HTTP 200 (soft 404). `<meta>` vào `<head>` nếu boundary xong trước shell, không
 * thì React ghi nó vào `<body>` (như streaming metadata của Next; Googlebot đọc DOM đầy đủ). Dùng cho trang lưới
 * `?page=` vượt quá (không kiểm ở proxy: mỗi lượt kiểm thêm ~100 ms cho mọi trang > 1), danh sách đơn vượt quá (trang
 * riêng tư, không index: 404 thật không có lợi), và làm dự phòng cho trang sách / danh mục / tác giả / một đơn khi proxy
 * không hỏi được DB (bình thường proxy trả 404 thật).
 * Không gọi `notFound()` ở đây: throw sau static shell làm React bỏ SSR của boundary (console: React error #419) rồi
 * dựng lại ở client.
 */
export function InlineNotFound({ kind, heading = 'h2', primary }: Props) {
  return (
    <div className="py-8">
      <meta name="robots" content="noindex" />
      <NotFoundView kind={kind} heading={heading} primary={primary} />
    </div>
  )
}
