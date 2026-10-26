'use client'

import { ArrowRightIcon, BookIcon } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useBlockedKeys } from '@/features/prefs/block-store'
import { useRouter } from '@/i18n/navigation'
import type { SearchHit } from '../schemas'
import { normalizeSearchQuery, paletteRow, parseSearchResponse } from '../search-input'

const DEBOUNCE_MS = 250
const SKELETON_ROWS = 3

type SearchResult = { q: string; status: 'success'; hits: SearchHit[] } | { q: string; status: 'error' }

async function fetchHits(q: string, signal: AbortSignal): Promise<SearchResult> {
  const response = await fetch(`/api/search?${new URLSearchParams({ q })}`, { signal })
  const hits = parseSearchResponse(await response.json())
  return hits ? { q, status: 'success', hits } : { q, status: 'error' }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Đóng không phải do chọn kết quả (Esc, bấm ra ngoài, Ctrl K lần nữa) → trả focus về chỗ đã mở palette */
  returnFocus: () => void
}

export default function SearchPalette({ open, onOpenChange, returnFocus }: Props) {
  const t = useTranslations('search')
  const router = useRouter()
  const [input, setInput] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  // Chọn kết quả → chuyển trang, không kéo focus về header (như trước)
  const navigating = useRef(false)
  // Chặn theo sở thích (quyết định (12)): mục chặn từ RevealBlocked (null: khách, chưa chặn, BlockStyles chưa stream
  // xong → không che). Sách đã bấm "Xem" giữ tới khi tải lại trang hoặc hết mục chặn (palette không unmount khi đóng).
  const blocks = useBlockedKeys()
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set())
  const [revealedTitle, setRevealedTitle] = useState('')

  // Chọn kết quả rồi mở lại trước khi hiệu ứng đóng xong (content chưa unmount) → lần đóng sau vẫn trả focus
  useEffect(() => {
    if (open) navigating.current = false
  }, [open])

  const q = normalizeSearchQuery(input)
  // Kết quả của từ khóa cũ (đang chờ debounce / fetch) coi như đang tải, không hiện lẫn
  const current = q !== null && result?.q === q ? result : null

  useEffect(() => {
    if (q === null) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetchHits(q, controller.signal).then(setResult, () => {
        if (!controller.signal.aborted) setResult({ q, status: 'error' })
      })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q])

  // Mọi đường đóng (Esc, bấm ra ngoài, chọn kết quả, Ctrl K ở search-trigger) đều xóa chữ đã gõ: theo `open`, không theo
  // từng chỗ gọi (đổi state khi prop đổi, trong lúc render)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) {
      setInput('')
      setRevealedTitle('')
    }
  }

  // Hết mục chặn (đăng xuất / đăng nhập là chuyển trang phía client, palette không unmount; bỏ chặn hết) → quên các dòng
  // đã Xem: người dùng sau trên cùng tab không thấy sách người trước đã mở
  const [hadBlocks, setHadBlocks] = useState(blocks !== null)
  if ((blocks !== null) !== hadBlocks) {
    setHadBlocks(blocks !== null)
    if (blocks === null) {
      setRevealed(new Set())
      setRevealedTitle('')
    }
  }

  function openBook(slug: string) {
    navigating.current = true
    onOpenChange(false)
    router.push({ pathname: '/books/[slug]', params: { slug } })
  }

  function reveal(hit: SearchHit) {
    setRevealed((current) => new Set(current).add(hit.id))
    // Nội dung option đổi tại chỗ (aria-activedescendant không đổi) → trình đọc màn hình không tự đọc lại: báo qua vùng live
    setRevealedTitle(hit.title)
  }

  function openSearchPage() {
    navigating.current = true
    onOpenChange(false)
    router.push({ pathname: '/search', query: { q: input.trim() } })
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('description')}
      className="top-4 sm:top-[12dvh] sm:max-w-xl"
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        if (navigating.current) {
          navigating.current = false
          return
        }
        returnFocus()
      }}
    >
      <Command shouldFilter={false} loop className="rounded-none! p-0">
        <CommandInput value={input} onValueChange={setInput} placeholder={t('placeholder')} />
        <CommandList className="max-h-[min(28rem,70dvh)] p-1">
          {q === null && <p className="px-3 py-6 text-sm text-muted-foreground">{t('hint')}</p>}

          {q !== null && current === null && <ResultsSkeleton />}

          {current?.status === 'error' && (
            <p role="alert" className="px-3 py-6 text-sm text-sale">
              {t('error')}
            </p>
          )}

          {current?.status === 'success' && current.hits.length === 0 && (
            <CommandEmpty className="px-3 py-10">
              <p className="font-medium">{t('empty', { q: input.trim() })}</p>
              <p className="mt-1 text-muted-foreground">{t('emptyHint')}</p>
            </CommandEmpty>
          )}

          {current?.status === 'success' && current.hits.length > 0 && (
            <>
              <CommandGroup>
                <CommandItem value="search-all" onSelect={openSearchPage} className="py-2.5">
                  <ArrowRightIcon aria-hidden className="text-primary" />
                  <span className="line-clamp-1">{t('seeAll', { q: input.trim() })}</span>
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading={t('books')}>
                {current.hits.map((hit) => {
                  // Dòng bị che: cùng CommandItem (cùng value → lựa chọn giữ nguyên sau khi Xem), không render tên / tác
                  // giả / bìa (không tải ảnh); Enter / bấm = Xem, lần sau mới mở sách. "Xem" là chữ, không lồng <button>
                  // trong option.
                  const veiled = paletteRow(hit, blocks, revealed) === 'veiled'
                  return (
                    <CommandItem
                      key={hit.id}
                      value={`book-${hit.id}`}
                      onSelect={() => (veiled ? reveal(hit) : openBook(hit.slug))}
                      className="gap-3"
                    >
                      {veiled ? (
                        <>
                          <span aria-hidden className="h-12 w-8 shrink-0 rounded-cover bg-surface-raised" />
                          <span className="min-w-0 flex-1 text-muted-foreground">
                            <span className="line-clamp-1">{t('hidden')}</span>
                          </span>
                          <span className="shrink-0 font-medium text-primary">{t('reveal')}</span>
                        </>
                      ) : (
                        <>
                          <Cover url={hit.coverUrl} />
                          <span className="min-w-0">
                            <span className="line-clamp-1 font-medium">{hit.title}</span>
                            {hit.authors.length > 0 && (
                              <span className="line-clamp-1 text-xs text-muted-foreground">{hit.authors.join(', ')}</span>
                            )}
                          </span>
                        </>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
        <p aria-live="polite" className="sr-only">
          {q !== null && current === null && t('loading')}
          {current?.status === 'success' && t('resultCount', { count: current.hits.length })}
        </p>
        <p aria-live="polite" className="sr-only">
          {revealedTitle}
        </p>
      </Command>
    </CommandDialog>
  )
}

// alt rỗng: tên sách nằm ngay cạnh ảnh trong cùng mục, đọc hai lần chỉ gây nhiễu cho trình đọc màn hình
function Cover({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="flex h-12 w-8 shrink-0 items-center justify-center rounded-cover bg-surface-raised text-subtle">
        <BookIcon aria-hidden className="size-4" />
      </span>
    )
  }
  return (
    <Image
      src={url}
      alt=""
      width={32}
      height={48}
      sizes="32px"
      loading="eager"
      className="h-12 w-8 shrink-0 rounded-cover object-cover"
    />
  )
}

function ResultsSkeleton() {
  return (
    <div aria-hidden className="space-y-1 p-1">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-1.5">
          <div className="h-12 w-8 shrink-0 animate-pulse rounded-cover bg-surface-raised" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded-sm bg-surface-raised" />
            <div className="h-3 w-1/3 animate-pulse rounded-sm bg-surface-raised" />
          </div>
        </div>
      ))}
    </div>
  )
}
