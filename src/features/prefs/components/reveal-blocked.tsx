'use client'

import { useEffect } from 'react'

/**
 * Nút "Xem" trên ô mờ của thẻ bị chặn: một listener ủy quyền trên document (không gắn handler cho từng thẻ, thẻ là
 * Server Component). Gắn `data-revealed` vào khung thẻ → hết khớp selector của blockCss → link sách hiện lại, chuyển
 * focus vào link. Chỉ sửa DOM hiện tại: tải lại / sang trang khác thì thẻ được render lại và che lại ("trong lần xem này").
 */
export function RevealBlocked() {
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
  return null
}
