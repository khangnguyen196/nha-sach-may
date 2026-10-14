'use client'

import { SearchIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useState, useSyncExternalStore } from 'react'

// Palette (cmdk + dialog) chỉ tải khi mở lần đầu; rê chuột / focus vào nút thì tải trước
const loadPalette = () => import('./search-palette')
const SearchPalette = dynamic(loadPalette, { ssr: false })

const subscribeNothing = () => () => {}
const isApplePlatform = () => /Mac|iPhone|iPad/.test(navigator.userAgent)

type Labels = { placeholder: string; open: string }

export function SearchTrigger({ labels }: { labels: Labels }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  // Server không biết hệ điều hành → render "Ctrl" rồi đổi sau hydration, không lệch markup
  const isApple = useSyncExternalStore(subscribeNothing, isApplePlatform, () => false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
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
        onClick={() => {
          setMounted(true)
          setOpen(true)
        }}
        onPointerEnter={() => void loadPalette()}
        onFocus={() => void loadPalette()}
        className="inline-flex size-9 items-center justify-center gap-2 rounded-lg text-muted-foreground transition-colors outline-none hover:bg-surface-raised hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:w-full md:max-w-sm md:justify-start md:border md:border-input md:bg-surface md:px-3 md:text-sm"
      >
        <SearchIcon aria-hidden className="size-4 shrink-0" />
        <span className="hidden md:inline">{labels.placeholder}</span>
        <span className="sr-only md:hidden">{labels.open}</span>
        <kbd
          aria-hidden
          className="ml-auto hidden rounded-sm border bg-surface-raised px-1.5 font-sans text-xs text-subtle md:inline"
        >
          {isApple ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>
      {mounted && <SearchPalette open={open} onOpenChange={setOpen} />}
    </>
  )
}
