'use client'

import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react'

/** Chuỗi của khối lỗi, dịch sẵn ở server (getLazyErrorLabels) */
export type LazyErrorLabels = { message: string; reload: string; close: string }

type Props = {
  labels: LazyErrorLabels
  /**
   * Đóng khối lỗi: cha gỡ cả boundary khỏi cây (mounted = false) và trả focus về nút mở. Bấm mở lại → React.lazy ném
   * lại đúng lỗi cũ → khối lỗi hiện lại; chỉ tải lại trang mới tải lại được chunk.
   */
  onDismiss: () => void
  children: ReactNode
}

/**
 * Bọc nội dung tải lười bằng next/dynamic (sheet bộ lọc, gợi ý mã, khung chat, palette). Chunk tải lỗi (mạng chập chờn,
 * bản deploy mới) → `React.lazy` của next/dynamic (tạo một lần ở cấp module, `lazy-dynamic/loadable.js`) giữ promise bị
 * từ chối tới khi tải lại trang và ném lỗi lên error boundary gần nhất: palette nằm trong Header của root layout →
 * global-error, mất cả trang. Boundary này giữ lỗi tại chỗ: khối báo + nút "Tải lại trang".
 *
 * Bắt mọi lỗi của phần con, không chỉ lỗi chunk: chữ của lỗi tải chunk khác nhau giữa Turbopack / trình duyệt, nhận
 * diện sai thì lỗi chunk lại lên global-error; lỗi render của dialog báo "không tải được phần này" vẫn hơn mất trang.
 *
 * Suspense riêng (fallback null): `dynamic()` không `ssr: false` và không `loading` không tự bọc Suspense
 * (loadable.js:49) → lần bấm đầu treo lên Suspense gần nhất phía trên, fallback của cả vùng đó có thể nháy. Có Suspense
 * ở đây nên không cần thêm `ssr: false`: phần con chỉ render sau khi bấm (state ở client), không có trong HTML server.
 */
export class LazyBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return <LazyError labels={this.props.labels} onDismiss={this.props.onDismiss} />
    return <Suspense fallback={null}>{this.props.children}</Suspense>
  }
}

/**
 * Khối báo nổi ngay dưới header (fixed): phần tải lười là dialog / sheet, không có chỗ trong bố cục để hiện tại chỗ.
 * Không Radix / Button / lucide: module này nằm trong bundle đầu của mọi trang (palette ở header).
 */
function LazyError({ labels, onDismiss }: { labels: LazyErrorLabels; onDismiss: () => void }) {
  const reloadRef = useRef<HTMLButtonElement>(null)

  // Nút vừa bấm không mở ra gì → đưa focus vào khối lỗi để bàn phím / trình đọc màn hình tới được nút
  useEffect(() => {
    reloadRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div
      role="alert"
      data-testid="lazy-error"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDismiss()
      }}
      className="fixed inset-x-4 top-20 z-50 mx-auto max-w-md rounded-xl border bg-surface p-4 text-base text-foreground"
    >
      <p>{labels.message}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          ref={reloadRef}
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {labels.reload}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex min-h-11 items-center rounded-lg border border-input px-5 font-medium transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {labels.close}
        </button>
      </div>
    </div>
  )
}
