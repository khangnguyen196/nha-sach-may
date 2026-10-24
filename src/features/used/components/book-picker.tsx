'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { Result } from '@/lib/errors'
import { fillTemplate } from '@/lib/template'
import type { ListingBookOption } from '../actions'

type Labels = {
  book: string
  bookSearch: string
  bookSearchPlaceholder: string
  bookSearchHint: string
  searching: string
  noResults: string
  resultsCount: string
  searchError: string
  chooseBook: string
  chooseBookLabel: string
  changeBook: string
  originalPrice: string
}

type Props = {
  book: ListingBookOption | null
  onChange: (book: ListingBookOption | null) => void
  /** Không có: sửa tin (không đổi sách) */
  searchBooks?: (q: string) => Promise<Result<ListingBookOption[]>>
  labels: Labels
  formatPrice: (value: number) => string
  error?: string
  disabled: boolean
}

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; books: ListingBookOption[] }
  | { status: 'error' }

const SEARCH_DELAY_MS = 300
const MIN_QUERY = 2

/** Thẻ một sách (bìa nhỏ alt="" vì tên sách ngay bên cạnh) */
function BookSummary({ book, labels, formatPrice }: Pick<Props, 'labels' | 'formatPrice'> & { book: ListingBookOption }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-cover bg-surface-raised">
        {book.coverUrl && <Image src={book.coverUrl} alt="" fill sizes="40px" className="object-cover" />}
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 block text-sm font-medium">{book.title}</span>
        {book.author && <span className="block truncate text-xs text-muted-foreground">{book.author}</span>}
        <span className="block text-xs text-muted-foreground">
          {fillTemplate(labels.originalPrice, { price: formatPrice(book.maxPrice) })}
        </span>
      </span>
    </span>
  )
}

/**
 * Chọn sách của tin: tìm trong catalog (Server Action, RPC search_books; chỉ sách đang bán), bấm "Chọn". id sách đi vào
 * form qua ô ẩn `book_id`; giá sách chỉ để hiện trần giá (RPC tự đọc giá, client không gửi giá sách).
 */
export function BookPicker({ book, onChange, searchBooks, labels, formatPrice, error, disabled }: Props) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef(0)
  const searchInput = useRef<HTMLInputElement>(null)
  const changeButton = useRef<HTMLButtonElement>(null)
  /** Nút vừa bấm bị gỡ khỏi trang ("Chọn" → thẻ sách, "Đổi sách" → ô tìm): focus phần tử thay thế sau lần render tới */
  const focusAfterRender = useRef<'change' | 'search' | null>(null)

  useEffect(() => {
    const target = focusAfterRender.current
    if (!target) return
    focusAfterRender.current = null
    ;(target === 'change' ? changeButton : searchInput).current?.focus()
  })

  function changeQuery(value: string) {
    setQuery(value)
    clearTimeout(timer.current)
    const request = ++latest.current
    if (!searchBooks || value.trim().length < MIN_QUERY) {
      setSearch({ status: 'idle' })
      return
    }
    setSearch({ status: 'loading' })
    timer.current = setTimeout(async () => {
      let result: Result<ListingBookOption[]>
      try {
        result = await searchBooks(value)
      } catch {
        result = { ok: false, code: 'NETWORK_ERROR' }
      }
      // Gõ tiếp trong lúc chờ: bỏ kết quả của từ khóa cũ
      if (request !== latest.current) return
      setSearch(result.ok ? { status: 'done', books: result.data } : { status: 'error' })
    }, SEARCH_DELAY_MS)
  }

  function choose(option: ListingBookOption) {
    focusAfterRender.current = 'change'
    onChange(option)
    setQuery('')
    setSearch({ status: 'idle' })
  }

  function change() {
    focusAfterRender.current = 'search'
    onChange(null)
  }

  const statusText =
    search.status === 'loading'
      ? labels.searching
      : search.status === 'error'
        ? labels.searchError
        : search.status === 'done'
          ? search.books.length === 0
            ? labels.noResults
            : fillTemplate(labels.resultsCount, { count: search.books.length })
          : ''

  return (
    <fieldset className="grid gap-2" aria-describedby={error ? 'listing-book-error' : undefined}>
      <legend className="text-sm font-medium">{labels.book}</legend>
      {book && <input type="hidden" name="book_id" value={book.id} />}
      {book ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-surface p-3" data-testid="listing-book">
          <BookSummary book={book} labels={labels} formatPrice={formatPrice} />
          {searchBooks && (
            <button
              ref={changeButton}
              type="button"
              onClick={change}
              disabled={disabled}
              className="h-9 shrink-0 rounded-md px-3 text-sm font-medium text-primary transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              {labels.changeBook}
            </button>
          )}
        </div>
      ) : (
        <>
          <label htmlFor="listing-book-search" className="sr-only">
            {labels.bookSearch}
          </label>
          <input
            ref={searchInput}
            id="listing-book-search"
            // Không có `name`: từ khóa không đi theo form
            type="search"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder={labels.bookSearchPlaceholder}
            autoComplete="off"
            maxLength={100}
            disabled={disabled}
            aria-describedby="listing-book-hint"
            aria-invalid={error ? true : undefined}
            className="h-11 w-full rounded-md border border-input bg-surface px-3 text-base text-foreground transition-colors outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          />
          <p id="listing-book-hint" className="text-xs text-muted-foreground">
            {labels.bookSearchHint}
          </p>
          <p role="status" className={statusText ? 'text-sm text-muted-foreground' : 'sr-only'}>
            {statusText}
          </p>
          {search.status === 'done' && search.books.length > 0 && (
            <ul className="grid gap-2" data-testid="listing-book-results">
              {search.books.map((option) => (
                <li key={option.id} className="flex items-center justify-between gap-3 rounded-lg border bg-surface p-3">
                  <BookSummary book={option} labels={labels} formatPrice={formatPrice} />
                  <button
                    type="button"
                    onClick={() => choose(option)}
                    disabled={disabled}
                    aria-label={fillTemplate(labels.chooseBookLabel, { title: option.title })}
                    className="h-9 shrink-0 rounded-md border border-input px-3 text-sm font-medium transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                  >
                    {labels.chooseBook}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && (
        <p id="listing-book-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}
