'use client'

import { useEffect, useRef } from 'react'

/**
 * <style> che thẻ bị chặn (CSS do server dựng bằng blockCss, chỉ id số + nhãn enum) + nút "Xem" trên ô mờ: một
 * listener ủy quyền trên document (không gắn handler cho từng thẻ, thẻ là Server Component). Gắn `data-revealed` vào
 * khung thẻ → hết khớp selector → link sách hiện lại, chuyển focus vào link. `data-revealed` gắn ngoài React, chỉ sống
 * cùng DOM hiện tại: tải lại trang là che lại; chuyển trang phía client mà React giữ nguyên DOM của thẻ (Back về trang
 * cũ, cùng sách ở lần render sau của cùng route) thì thẻ đã Xem có thể vẫn hiện.
 * `data-ready` trên <style> (gắn trong effect, ngoài props của React): listener đã gắn, e2e chờ trước khi bấm Xem.
 */
export function RevealBlocked({ css }: { css: string }) {
  const styleRef = useRef<HTMLStyleElement>(null)
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return
      const slot = event.target.closest('[data-reveal]')?.closest('[data-book-slot]')
      if (!slot) return
      slot.setAttribute('data-revealed', '')
      slot.querySelector<HTMLElement>('[data-book-link]')?.focus()
    }
    document.addEventListener('click', onClick)
    styleRef.current?.setAttribute('data-ready', '')
    return () => document.removeEventListener('click', onClick)
  }, [])
  return (
    <style ref={styleRef} data-testid="block-styles">
      {css}
    </style>
  )
}
