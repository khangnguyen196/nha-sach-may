'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  labels: { title: string; close: string }
  /** Nút mở nằm ngoài Sheet (không phải SheetTrigger) → tự trả focus khi đóng */
  returnFocus: () => void
  children: ReactNode
}

/** Nội dung sheet bộ lọc (Radix Dialog), tải lười từ FilterSheet. Bấm một lựa chọn (Link) → điều hướng và đóng sheet. */
export function FilterSheetContent({ open, onOpenChange, labels, returnFocus, children }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('a')) onOpenChange(false)
        }}
      >
        <SheetHeader className="pb-0">
          <SheetTitle>{labels.title}</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto px-4">{children}</div>
        <SheetFooter>
          <SheetClose asChild>
            <Button size="lg">{labels.close}</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
