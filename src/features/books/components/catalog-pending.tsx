'use client'

import { useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react'

type Props = {
  /** Bộ tham số catalog đang hiển thị (server render): đổi = trang mới đã tới → hết đang tải */
  stateKey: string
  loadingLabel: string
  children: ReactNode
}

/**
 * Phản hồi ngay khi bấm sắp xếp / lọc / sang trang: điều hướng client có thể mất 1–2 giây trên mobile chậm (đo:
 * sang trang 2 ~2 s) mà màn hình đứng yên. Link trong vùng này trỏ cùng trang, khác query (lọc, chip danh mục con,
 * phân trang, xóa bộ lọc) hoặc đổi ô sắp xếp → `data-pending` (lưới mờ đi, aria-busy) tới khi server render bộ tham số
 * mới. Link sang trang sách (khác pathname) không tính. Link vẫn là <a> thật (chạy không cần JS).
 */
export function CatalogPending({ stateKey, loadingLabel, children }: Props) {
  const [pending, setPending] = useState(false)
  const [shownKey, setShownKey] = useState(stateKey)
  // Server render xong tham số mới → reset (cập nhật state trong render theo giá trị trước, không cần effect)
  if (shownKey !== stateKey) {
    setShownKey(stateKey)
    setPending(false)
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest('a') : null
    if (!(link instanceof HTMLAnchorElement) || link.target === '_blank') return
    const url = new URL(link.href)
    if (url.origin === location.origin && url.pathname === location.pathname && url.search !== location.search) {
      setPending(true)
    }
  }

  function onChangeCapture(event: ChangeEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLSelectElement) setPending(true)
  }

  return (
    <div
      className="group/catalog"
      data-pending={pending ? '' : undefined}
      aria-busy={pending || undefined}
      onClickCapture={onClickCapture}
      onChangeCapture={onChangeCapture}
    >
      {/* aria-live, không role="status": "N cuốn sách" của CatalogView đã là status của vùng này */}
      <p aria-live="polite" className="sr-only" data-testid="catalog-loading">
        {pending ? loadingLabel : ''}
      </p>
      {children}
    </div>
  )
}
