'use client'

import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { LazyBoundary, type LazyErrorLabels } from '@/components/lazy-boundary'
import type { VoucherCard } from '../voucher-suggestions'

// Danh sách mã (Radix Dialog) chỉ tải khi khách bấm nút: phần lớn lượt mở trang thanh toán không cần tới
const VoucherPickerDialog = dynamic(() => import('./voucher-picker-dialog').then((mod) => mod.VoucherPickerDialog))

export type VoucherPickerLabels = { pick: string; title: string; use: string; close: string }

type Props = {
  vouchers: VoucherCard[]
  labels: VoucherPickerLabels
  /** Chunk danh sách mã tải lỗi (LazyBoundary) */
  lazyError: LazyErrorLabels
  /** Form GET của ô mã (VOUCHER_FORM_ID) và ô nhập: "Áp dụng" = điền mã + gửi đúng form đó */
  formId: string
  inputId: string
}

/**
 * Nút "Chọn mã giảm giá" cạnh ô mã. Áp dụng một mã đi qua đúng luồng gõ tay: điền ô rồi gửi form GET
 * (`/thanh-toan?voucher=…`), server kiểm lại bằng quote_order, VoucherPending hiện "Đang tính lại…".
 */
export function VoucherPicker({ vouchers, labels, lazyError, formId, inputId }: Props) {
  const [open, setOpen] = useState(false)
  // Giữ dialog trong cây sau lần mở đầu để có hiệu ứng đóng
  const [mounted, setMounted] = useState(false)
  // Chunk tải lỗi (LazyBoundary): khối lỗi đang hiện → bấm lại không mở, chỉ Đóng / Tải lại
  const [failed, setFailed] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function apply(code: string) {
    const input = document.getElementById(inputId)
    const form = document.getElementById(formId)
    if (!(input instanceof HTMLInputElement) || !(form instanceof HTMLFormElement)) return
    input.value = code
    setOpen(false)
    form.requestSubmit()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          if (failed) return
          setMounted(true)
          setOpen(true)
        }}
        className="inline-flex min-h-11 items-center rounded-sm text-base font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-0 sm:text-sm"
      >
        {labels.pick}
      </button>
      {mounted && (
        <LazyBoundary
          labels={lazyError}
          onError={() => {
            setOpen(false)
            setFailed(true)
          }}
          onDismiss={() => {
            setOpen(false)
            setMounted(false)
            setFailed(false)
            triggerRef.current?.focus()
          }}
        >
          <VoucherPickerDialog
            open={open}
            onOpenChange={setOpen}
            vouchers={vouchers}
            labels={labels}
            onApply={apply}
            returnFocus={() => triggerRef.current?.focus()}
          />
        </LazyBoundary>
      )}
    </>
  )
}
