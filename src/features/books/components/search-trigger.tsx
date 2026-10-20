'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { LazyBoundary, type LazyErrorLabels } from '@/components/lazy-boundary'

// Palette (cmdk + dialog) chỉ tải khi mở lần đầu; rê chuột / focus vào nút thì tải trước
const loadPalette = () => import('./search-palette')
const SearchPalette = dynamic(loadPalette, { ssr: false })

const subscribeNothing = () => () => {}
const isApplePlatform = () => /Mac|iPhone|iPad/.test(navigator.userAgent)

type Labels = { placeholder: string; open: string }

type Props = {
  labels: Labels
  /** Chunk palette tải lỗi (LazyBoundary): không còn lên global-error (palette nằm trong Header của root layout) */
  lazyError: LazyErrorLabels
  /** Icon do Server Component cha render (client leaf không import lucide, perf-js bước C) */
  icon: ReactNode
}

export function SearchTrigger({ labels, lazyError, icon }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  // Đóng palette (Esc, bấm ra ngoài, Ctrl K lần nữa) → focus về chỗ đã mở: nút (bấm) hoặc phần tử đang focus lúc nhấn
  // Ctrl K (kể cả ô nhập của khung chat). Palette không phải Dialog.Trigger của Radix nên Radix không tự trả focus.
  const returnTo = useRef<HTMLElement | null>(null)
  // Listener keydown đăng ký một lần → đọc trạng thái mở qua ref
  const openRef = useRef(false)
  // Server không biết hệ điều hành → render "Ctrl" rồi đổi sau hydration, không lệch markup
  const isApple = useSyncExternalStore(subscribeNothing, isApplePlatform, () => false)

  useEffect(() => {
    openRef.current = open
  }, [open])

  function returnFocus() {
    const target = returnTo.current
    // Như FocusScope của Radix: không cuộn trang tới phần tử
    if (target?.isConnected && target !== document.body) target.focus({ preventScroll: true })
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        // Đang mở (phím tắt này sẽ đóng) thì giữ chỗ đã lưu lúc mở. Vừa đóng mà hiệu ứng đóng chưa xong (focus còn ở ô
        // nhập của palette, sắp bị gỡ) cũng giữ chỗ cũ.
        const active = document.activeElement
        if (!openRef.current && !(active instanceof Element && active.closest('[cmdk-root]'))) {
          returnTo.current = active instanceof HTMLElement ? active : null
        }
        setMounted(true)
        setOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={(event) => {
          returnTo.current = event.currentTarget
          setMounted(true)
          setOpen(true)
        }}
        // Tải trước lỗi (mạng chập chờn) thì bỏ qua; lỗi tải khi bấm: LazyBoundary
        onPointerEnter={() => void loadPalette().catch(() => {})}
        onFocus={() => void loadPalette().catch(() => {})}
        className="inline-flex size-9 items-center justify-center gap-2 rounded-lg text-muted-foreground transition-colors outline-none hover:bg-surface-raised hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:w-full md:max-w-sm md:justify-start md:border md:border-input md:bg-surface md:px-3 md:text-sm [&_svg]:size-4 [&_svg]:shrink-0"
      >
        {icon}
        <span className="hidden md:inline">{labels.placeholder}</span>
        <span className="sr-only md:hidden">{labels.open}</span>
        <kbd
          aria-hidden
          className="ml-auto hidden rounded-sm border bg-surface-raised px-1.5 font-sans text-xs text-subtle md:inline"
        >
          {isApple ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>
      {mounted && (
        <LazyBoundary
          labels={lazyError}
          onDismiss={() => {
            setOpen(false)
            setMounted(false)
            returnFocus()
          }}
        >
          <SearchPalette open={open} onOpenChange={setOpen} returnFocus={returnFocus} />
        </LazyBoundary>
      )}
    </>
  )
}
