'use client'

import { useEffect, useState, type ReactNode } from 'react'

type Props = { formId: string; label: string; children: ReactNode }

/**
 * Áp dụng voucher là form GET thường (tải lại cả trang thanh toán, chạy không cần JS): trên mobile chậm mất ~1,5 s mà
 * màn hình đứng yên. Bấm "Áp dụng" → khối tổng tiền mờ đi + "Đang tính lại…" tới khi trang mới hiện ra.
 * Quay lại bằng Back (trang lấy từ bfcache) → bỏ trạng thái đang tính.
 */
export function VoucherPending({ formId, label, children }: Props) {
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const form = document.getElementById(formId)
    if (!(form instanceof HTMLFormElement)) return
    const onSubmit = () => setPending(true)
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false)
    }
    form.addEventListener('submit', onSubmit)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      form.removeEventListener('submit', onSubmit)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [formId])

  return (
    <div
      data-pending={pending ? '' : undefined}
      aria-busy={pending || undefined}
      className="transition-opacity duration-200 ease-out data-pending:opacity-50 motion-reduce:transition-none"
    >
      {/* aria-live, không role="status": trang thanh toán đã có status riêng (lỗi / kết quả đặt hàng) */}
      <p aria-live="polite" className="sr-only" data-testid="voucher-pending">
        {pending ? label : ''}
      </p>
      {pending && (
        <p aria-hidden className="mt-4 text-sm text-muted-foreground">
          {label}
        </p>
      )}
      {children}
    </div>
  )
}
