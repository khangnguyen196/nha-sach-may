'use client'

import { cn } from 'cn'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LazyBoundary, type LazyErrorLabels } from '@/components/lazy-boundary'
import { usePathname } from '@/i18n/navigation'
import type { ChatBrowseCategory, ChatLabels } from '../labels'
import { currentBookSlug, isChatHidden } from '../visibility'
import { readAgeConfirmed, writeAgeConfirmed, type ChatEntry } from './chat-state'

// Lúc tải trang chỉ có nút này; khung chat (Dialog, thẻ sách, Server Action) chỉ tải khi rê chuột / focus / bấm
const loadPanel = () => import('./chat-panel')
const ChatPanel = dynamic(loadPanel, { ssr: false })

/** Dải đáy màn hình mà bong bóng chiếm (56px nút + 16px lề + khoảng thở) */
const BOTTOM_BAND_PX = 88
const AVOID_SELECTOR = '[data-chat-avoid]'

type Props = {
  labels: ChatLabels
  categories: ChatBrowseCategory[]
  /** Chunk khung chat tải lỗi (LazyBoundary) */
  lazyError: LazyErrorLabels
  /** Icon do Server Component cha render (client leaf không import lucide, perf-js bước C) */
  icon: ReactNode
}

/** Đọc pathname / params trong Suspense riêng: App Shell của slug chưa biết vẫn prerender được (như LocaleSwitcher) */
export function ChatBubble(props: Props) {
  return (
    <Suspense fallback={null}>
      <ChatBubbleInner {...props} />
    </Suspense>
  )
}

/**
 * Ẩn bong bóng khi một phần tử [data-chat-avoid] (nút "Thêm vào giỏ", "Thanh toán") đi vào dải đáy màn hình, để không
 * che CTA. Phần tử có thể stream tới sau (Suspense) → quét lại khi DOM đổi.
 */
function useAvoidBottomBand(pathname: string) {
  const [covered, setCovered] = useState(false)
  useEffect(() => {
    const visible = new Set<Element>()
    let observer: IntersectionObserver | null = null
    const observed = new Set<Element>()

    function connect() {
      observer?.disconnect()
      observed.clear()
      visible.clear()
      setCovered(false)
      const top = Math.max(0, window.innerHeight - BOTTOM_BAND_PX)
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target)
            else visible.delete(entry.target)
          }
          setCovered(visible.size > 0)
        },
        { rootMargin: `-${top}px 0px 0px 0px` },
      )
      scan()
    }

    function scan() {
      for (const element of document.querySelectorAll(AVOID_SELECTOR)) {
        if (observed.has(element)) continue
        observed.add(element)
        observer?.observe(element)
      }
    }

    connect()
    const mutations = new MutationObserver(scan)
    mutations.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', connect)
    return () => {
      observer?.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', connect)
    }
  }, [pathname])
  return covered
}

function ChatBubbleInner({ labels, categories, lazyError, icon }: Props) {
  const pathname = usePathname()
  const params = useParams()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  // Chunk tải lỗi (LazyBoundary): khối lỗi đang hiện → bấm lại không mở (aria-expanded giữ false), chỉ Đóng / Tải lại
  const [failed, setFailed] = useState(false)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const covered = useAvoidBottomBand(pathname)

  const confirmAge = useCallback(() => {
    writeAgeConfirmed()
    setAgeConfirmed(true)
  }, [])

  if (isChatHidden(pathname)) {
    // Trang ẩn chat (thanh toán): đóng khung và gỡ khối lỗi chunk nếu đang hiện, để khi quay lại khung / khối lỗi không tự
    // hiện và kéo focus; giữ cuộc trò chuyện (`entries`) và xác nhận tuổi (đặt lại trong lúc render, có điều kiện nên chỉ
    // render lại một lần; không dùng effect)
    if (open) setOpen(false)
    if (failed) {
      setFailed(false)
      setMounted(false)
    }
    return null
  }
  const hidden = covered && !open

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={labels.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="chat-bubble"
        // Tải trước lỗi (mạng chập chờn) thì bỏ qua; lỗi tải khi bấm: LazyBoundary
        onPointerEnter={() => void loadPanel().catch(() => {})}
        onFocus={() => void loadPanel().catch(() => {})}
        onClick={() => {
          if (failed) return
          setMounted(true)
          // sessionStorage chỉ đọc ở client, khi khách mở khung (không lệch markup lúc hydrate)
          setAgeConfirmed((current) => current || readAgeConfirmed())
          setOpen((current) => !current)
        }}
        inert={hidden}
        className={cn(
          'fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-30',
          'inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground',
          'transition-[opacity,translate] duration-200 ease-out outline-none hover:-translate-y-0.5',
          'focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none [&_svg]:size-6',
          hidden && 'pointer-events-none invisible translate-y-4 opacity-0',
        )}
      >
        {icon}
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
            button.current?.focus()
          }}
        >
          <ChatPanel
            open={open}
            onOpenChange={setOpen}
            labels={labels}
            categories={categories}
            slug={currentBookSlug(pathname, params)}
            entries={entries}
            setEntries={setEntries}
            ageConfirmed={ageConfirmed}
            onConfirmAge={confirmAge}
            returnFocus={button}
          />
        </LazyBoundary>
      )}
    </>
  )
}
