'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { LazyBoundary, type LazyErrorLabels } from '@/components/lazy-boundary'

// Palette (cmdk + dialog) chỉ tải khi mở lần đầu; rê chuột / focus vào nút thì tải trước
const loadPalette = () => import('./search-palette')
const SearchPalette = dynamic(loadPalette, { ssr: false })

const subscribeNothing = () => () => {}
const isApplePlatform = () => /Mac|iPhone|iPad/.test(navigator.userAgent)
const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

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
  // Chunk palette tải lỗi (LazyBoundary): khối lỗi đang hiện → nút / Ctrl K không mở lại, chỉ Đóng / Tải lại
  const failedRef = useRef(false)
  // Phím gõ sau khi mở mà ô nhập của palette chưa có focus (chunk còn đang tải): giữ lại, chuyển vào ô khi ô nhận focus.
  // null = không giữ (palette đóng, ô đã nhận phím, hoặc lúc mở đang gõ trong ô nhập khác: phím thuộc về ô đó)
  const typedRef = useRef<string | null>(null)
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

  // Ô nhập của palette nhận focus → lấy các phím đã giữ, thôi giữ
  const takeTyped = useCallback(() => {
    const typed = typedRef.current ?? ''
    typedRef.current = null
    return typed
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        if (failedRef.current) return
        // Đang mở (phím tắt này sẽ đóng) thì giữ chỗ đã lưu lúc mở. Vừa đóng mà hiệu ứng đóng chưa xong (focus còn ở ô
        // nhập của palette, sắp bị gỡ) cũng giữ chỗ cũ.
        const active = document.activeElement
        const inPalette = active instanceof Element && active.closest('[cmdk-root]')
        if (!openRef.current && !inPalette) returnTo.current = active instanceof HTMLElement ? active : null
        typedRef.current = openRef.current || inPalette || isEditable(active) ? null : ''
        setMounted(true)
        setOpen((current) => !current)
      }
    }
    // Pha capture: chặn trước khi phím tới phần tử đang focus (Space trên nút / link, cuộn trang)
    function holdTyped(event: KeyboardEvent) {
      const typed = typedRef.current
      if (typed === null || event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return
      if (event.key === 'Escape') {
        typedRef.current = null
        setOpen(false)
      } else if (event.key === 'Backspace') {
        typedRef.current = typed.slice(0, -1)
      } else if (event.key.length === 1) {
        typedRef.current = typed + event.key
      } else {
        return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keydown', holdTyped, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keydown', holdTyped, true)
    }
  }, [])

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={(event) => {
          if (failedRef.current) return
          returnTo.current = event.currentTarget
          typedRef.current = ''
          setMounted(true)
          setOpen(true)
        }}
        // Tải trước lỗi (mạng chập chờn) thì bỏ qua; lỗi tải khi bấm: LazyBoundary
        onPointerEnter={() => void loadPalette().catch(() => {})}
        onFocus={() => void loadPalette().catch(() => {})}
        className="inline-flex size-9 items-center justify-center gap-2 rounded-lg text-muted-foreground transition-colors outline-none hover:bg-surface-raised hover:text-foreground focus-visible:ring-3 focus-visible:ring-focus-ring md:w-full md:max-w-sm md:justify-start md:border md:border-input md:bg-surface md:px-3 md:text-sm [&_svg]:size-4 [&_svg]:shrink-0"
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
          onError={() => {
            failedRef.current = true
            typedRef.current = null
            setOpen(false)
          }}
          onDismiss={() => {
            failedRef.current = false
            setOpen(false)
            setMounted(false)
            returnFocus()
          }}
        >
          <SearchPalette open={open} onOpenChange={setOpen} returnFocus={returnFocus} takeTyped={takeTyped} />
        </LazyBoundary>
      )}
    </>
  )
}
