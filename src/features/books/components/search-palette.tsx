'use client'

import { ArrowRightIcon, BookIcon } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useRouter } from '@/i18n/navigation'
import { searchQuerySchema, searchResponseSchema, type SearchHit } from '../schemas'

const DEBOUNCE_MS = 250
const SKELETON_ROWS = 3

type SearchResult = { q: string; status: 'success'; hits: SearchHit[] } | { q: string; status: 'error' }

async function fetchHits(q: string, signal: AbortSignal): Promise<SearchResult> {
  const response = await fetch(`/api/search?${new URLSearchParams({ q })}`, { signal })
  const body = searchResponseSchema.safeParse(await response.json())
  return body.success ? { q, status: 'success', hits: body.data.data } : { q, status: 'error' }
}

type Props = { open: boolean; onOpenChange: (open: boolean) => void }

export default function SearchPalette({ open, onOpenChange }: Props) {
  const t = useTranslations('search')
  const router = useRouter()
  const [input, setInput] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)

  const parsed = searchQuerySchema.safeParse(input)
  const q = parsed.success ? parsed.data : null
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

  function handleOpenChange(next: boolean) {
    if (!next) setInput('')
    onOpenChange(next)
  }

  function openBook(slug: string) {
    handleOpenChange(false)
    router.push({ pathname: '/books/[slug]', params: { slug } })
  }

  function openSearchPage() {
    handleOpenChange(false)
    router.push({ pathname: '/search', query: { q: input.trim() } })
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('title')}
      description={t('description')}
      className="top-4 sm:top-[12dvh] sm:max-w-xl"
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
                {current.hits.map((hit) => (
                  <CommandItem
                    key={hit.id}
                    value={`book-${hit.id}`}
                    onSelect={() => openBook(hit.slug)}
                    className="gap-3"
                  >
                    <Cover url={hit.coverUrl} />
                    <span className="min-w-0">
                      <span className="line-clamp-1 font-medium">{hit.title}</span>
                      {hit.authors.length > 0 && (
                        <span className="line-clamp-1 text-xs text-muted-foreground">{hit.authors.join(', ')}</span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
        <p aria-live="polite" className="sr-only">
          {q !== null && current === null && t('loading')}
          {current?.status === 'success' && t('resultCount', { count: current.hits.length })}
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
