'use client'

import { SlidersHorizontalIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type Props = {
  labels: { trigger: string; title: string; close: string }
  /** Các nhóm filter (Server Component, toàn Link) */
  children: ReactNode
}

/** Bộ lọc trên mobile. Bấm một lựa chọn (Link) → điều hướng và đóng sheet. */
export function FilterSheet({ labels, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg" className="md:hidden">
          <SlidersHorizontalIcon aria-hidden />
          {labels.trigger}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('a')) setOpen(false)
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
