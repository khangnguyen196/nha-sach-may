'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = { listId: string; labels: { previous: string; next: string } }
type Edges = { start: boolean; end: boolean }

/**
 * Nút trước / sau cho kệ trên desktop (chuột không cuộn ngang được). Chỉ hiện từ `md` và khi kệ có chỗ để cuộn;
 * không JS thì không hiện (kệ vẫn cuộn bằng trackpad / thanh cuộn). Mỗi lần bấm cuộn ~ một màn kệ, scroll-snap căn thẻ.
 */
export function ShelfNav({ listId, labels }: Props) {
  // null = chưa đo (SSR / chưa mount) hoặc kệ không tràn → không render nút
  const [edges, setEdges] = useState<Edges | null>(null)

  useEffect(() => {
    const list = document.getElementById(listId)
    if (!list) return
    const update = () => {
      const max = list.scrollWidth - list.clientWidth
      // 1px dung sai: scrollLeft có thể là số lẻ khi trình duyệt phóng to
      setEdges(max <= 1 ? null : { start: list.scrollLeft <= 1, end: list.scrollLeft >= max - 1 })
    }
    update()
    list.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(list)
    return () => {
      list.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [listId])

  if (!edges) return null

  const scroll = (direction: 1 | -1) => {
    const list = document.getElementById(listId)
    if (!list) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollBy({ left: direction * list.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className="hidden gap-1 md:flex">
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.previous}
        aria-controls={listId}
        disabled={edges.start}
        onClick={() => scroll(-1)}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.next}
        aria-controls={listId}
        disabled={edges.end}
        onClick={() => scroll(1)}
      >
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  )
}
