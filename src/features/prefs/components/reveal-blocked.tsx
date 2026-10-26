'use client'

import { useEffect } from 'react'

/**
 * <style> che thẻ bị chặn (CSS do server dựng bằng blockCss, chỉ id số + nhãn enum) + nút "Xem" trên ô mờ: một
 * listener ủy quyền trên document (không gắn handler cho từng thẻ, thẻ là Server Component). Gắn `data-revealed` vào
 * khung thẻ → hết khớp selector → link sách hiện lại, chuyển focus vào link. Chỉ sửa DOM hiện tại: tải lại / sang trang
 * khác thì thẻ được render lại và che lại ("trong lần xem này"). <style> render ở đây (không ở BlockStyles) để e2e biết
 * listener đã gắn: phần tử đã hydrate (`__reactProps`) + main thread rảnh.
 */
export function RevealBlocked({ css }: { css: string }) {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return
      const slot = event.target.closest('[data-reveal]')?.closest('[data-book-slot]')
      if (!slot) return
      slot.setAttribute('data-revealed', '')
      slot.querySelector<HTMLElement>('[data-book-link]')?.focus()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])
  return <style data-testid="block-styles">{css}</style>
}
