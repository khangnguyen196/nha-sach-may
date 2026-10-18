'use client'

import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VoucherCard } from '../voucher-suggestions'
import type { VoucherPickerLabels } from './voucher-picker'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vouchers: VoucherCard[]
  labels: VoucherPickerLabels
  onApply: (code: string) => void
  /** Nút mở nằm ngoài Dialog.Root (không phải Dialog.Trigger) → tự trả focus khi đóng */
  returnFocus: () => void
}

/**
 * Danh sách mã gợi ý. Mobile (< sm): tấm trượt từ đáy, chữ ≥ 16px, nút ≥ 44px. Từ sm: dialog nhỏ giữa màn hình.
 * Một Radix Dialog với class responsive, không cần đo kích thước màn hình bằng JS.
 */
export function VoucherPickerDialog({ open, onOpenChange, vouchers, labels, onApply, returnFocus }: Props) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus()
          }}
          data-testid="voucher-picker"
          className={cn(
            'fixed z-50 flex flex-col bg-popover text-popover-foreground ring-1 ring-foreground/10 outline-none',
            'duration-200 ease-out data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none',
            'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl max-sm:data-open:slide-in-from-bottom max-sm:data-closed:slide-out-to-bottom',
            'sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:max-h-[80dvh] sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-2 sm:py-3">
            <DialogPrimitive.Title className="font-serif text-lg font-medium">{labels.title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-lg" className="size-11 sm:size-9" aria-label={labels.close}>
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <ul className="grid gap-3 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {vouchers.map((voucher) => (
              <VoucherOption key={voucher.code} voucher={voucher} label={labels.use} onApply={onApply} />
            ))}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function VoucherOption({ voucher, label, onApply }: { voucher: VoucherCard; label: string; onApply: (code: string) => void }) {
  const reasonId = useId()
  const eligible = voucher.reason === null

  return (
    <li className="rounded-lg border bg-surface p-4" data-testid="voucher-option" data-eligible={eligible}>
      {/* Mã chưa đủ điều kiện: làm mờ phần mô tả, lý do bên dưới giữ đủ tương phản */}
      <div className={cn('grid gap-1 text-base sm:text-sm', !eligible && 'opacity-60')}>
        <p className="font-mono font-semibold">{voucher.code}</p>
        <p className="font-medium text-primary">{voucher.benefit}</p>
        {voucher.note && <p className="text-muted-foreground">{voucher.note}</p>}
        <p className="text-muted-foreground">
          {voucher.condition} · {voucher.expires}
        </p>
      </div>
      {voucher.reason && (
        <p id={reasonId} className="mt-2 text-base text-foreground sm:text-sm" data-testid="voucher-reason">
          {voucher.reason}
        </p>
      )}
      <Button
        type="button"
        size="lg"
        variant={eligible ? 'default' : 'outline'}
        disabled={!eligible}
        aria-describedby={eligible ? undefined : reasonId}
        onClick={() => onApply(voucher.code)}
        className="mt-3 h-11 w-full px-4 text-base sm:h-9 sm:w-auto sm:text-sm"
      >
        {label}
      </Button>
    </li>
  )
}
