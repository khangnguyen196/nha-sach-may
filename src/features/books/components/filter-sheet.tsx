'use client'

import dynamic from 'next/dynamic'
import { useRef, useState, type ReactNode } from 'react'
import { LazyBoundary, type LazyErrorLabels } from '@/components/lazy-boundary'
import { Button } from '@/components/ui/button'

// Nội dung sheet (Radix Dialog, react-remove-scroll, focus trap…) chỉ tải khi bấm; rê chuột / focus vào nút thì tải trước
const loadContent = () => import('./filter-sheet-content')
const FilterSheetContent = dynamic(() => loadContent().then((mod) => mod.FilterSheetContent))

type Props = {
  labels: { trigger: string; title: string; close: string }
  /** Chunk nội dung sheet tải lỗi (LazyBoundary) */
  lazyError: LazyErrorLabels
  /** Các nhóm filter (Server Component, toàn Link) */
  children: ReactNode
  /** Icon do Server Component cha render (client leaf không import lucide, perf-js bước C) */
  icon: ReactNode
}

/** Bộ lọc trên mobile: nút mở (không Radix) + nội dung sheet tải lười. */
export function FilterSheet({ labels, lazyError, children, icon }: Props) {
  const [open, setOpen] = useState(false)
  // Giữ sheet trong cây sau lần mở đầu để có hiệu ứng đóng
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="lg"
        className="md:hidden"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMounted(true)
          setOpen(true)
        }}
        // Tải trước lỗi (mạng chập chờn) thì bỏ qua; lỗi tải khi bấm: LazyBoundary
        onPointerEnter={() => void loadContent().catch(() => {})}
        onFocus={() => void loadContent().catch(() => {})}
      >
        {icon}
        {labels.trigger}
      </Button>
      {mounted && (
        <LazyBoundary
          labels={lazyError}
          onError={() => setOpen(false)}
          onDismiss={() => {
            setOpen(false)
            setMounted(false)
            triggerRef.current?.focus()
          }}
        >
          <FilterSheetContent
            open={open}
            onOpenChange={setOpen}
            labels={labels}
            returnFocus={() => triggerRef.current?.focus()}
          >
            {children}
          </FilterSheetContent>
        </LazyBoundary>
      )}
    </>
  )
}
