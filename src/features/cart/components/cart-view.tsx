'use client'

import { BookIcon, MinusIcon, PlusIcon, ShoppingBagIcon, Trash2Icon } from 'lucide-react'
import Image from 'next/image'
import type { Locale } from 'next-intl'
import { useState, type KeyboardEvent } from 'react'
import { SupportEmailText } from '@/components/layout/support-email-text'
import { Button, buttonVariants } from '@/components/ui/button'
import { formats } from '@/i18n/formats'
import { Link } from '@/i18n/navigation'
import { fillTemplate } from '@/lib/template'
import { cn } from '@/lib/utils'
import { cartLimit } from '../guest-cart'
import type { CartLine, CartQuote } from '../queries'
import { freeShipStatus } from '../utils'

/** Chuỗi đã dịch từ server (features/cart/labels.ts). `{title}`, `{stock}`, `{amount}` điền ở client. */
export type CartViewLabels = {
  lines: string
  unavailable: string
  unavailableTitle: string
  unavailableHint: string
  removeLabel: string
  removeUnavailableLabel: string
  decreaseLabel: string
  increaseLabel: string
  quantityLabel: string
  unitPrice: string
  lineTotal: string
  overStock: string
  soldOut: string
  reduceTo: string
  summary: string
  itemCount: string
  subtotal: string
  shipping: string
  freeShipping: string
  total: string
  freeShipRemaining: string
  freeShipReached: string
  freeShipProgress: string
  checkout: string
  updating: string
  error: string
}

type Props = {
  lines: CartLine[]
  quote: CartQuote
  /** Đang chờ server (debounce, action, tải lại): tóm tắt mờ đi tới khi có quote mới */
  updating: boolean
  error: string | null
  labels: CartViewLabels
  locale: Locale
  onQuantityChange: (bookId: number, quantity: number) => void
  onRemove: (bookId: number) => void
}

/** Giao diện giỏ dùng chung cho khách (localStorage) và tài khoản (Server Action). Rỗng → trang tự hiện EmptyState. */
export function CartView({ lines, quote, updating, error, labels, locale, onQuantityChange, onRemove }: Props) {
  const formatPrice = new Intl.NumberFormat(locale, formats.number.price).format

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
      <section aria-labelledby="cart-lines">
        <h2 id="cart-lines" className="sr-only">
          {labels.lines}
        </h2>
        <ul className="divide-y border-y">
          {lines.map((line) => (
            <CartLineItem
              key={line.book_id}
              line={line}
              labels={labels}
              formatPrice={formatPrice}
              onQuantityChange={onQuantityChange}
              onRemove={onRemove}
            />
          ))}
        </ul>
      </section>
      <CartSummary
        lines={lines}
        quote={quote}
        updating={updating}
        error={error}
        labels={labels}
        formatPrice={formatPrice}
      />
    </div>
  )
}

type LineProps = {
  line: CartLine
  labels: CartViewLabels
  formatPrice: (value: number) => string
  onQuantityChange: (bookId: number, quantity: number) => void
  onRemove: (bookId: number) => void
}

function CartLineItem({ line, labels, formatPrice, onQuantityChange, onRemove }: LineProps) {
  const { book } = line
  if (!book) {
    return (
      <li className="flex gap-4 py-5" data-testid="cart-line">
        <CoverPlaceholder />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-muted-foreground">{labels.unavailableTitle}</p>
          <p className="mt-1 inline-block rounded-sm bg-surface-raised px-1.5 py-0.5 text-xs font-medium">
            {labels.unavailable}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{labels.unavailableHint}</p>
        </div>
        <RemoveButton label={labels.removeUnavailableLabel} onClick={() => onRemove(line.book_id)} />
      </li>
    )
  }

  const limit = cartLimit(book.stock)
  const values = { title: book.title, stock: book.stock }

  return (
    <li className="flex gap-4 py-5" data-testid="cart-line">
      {/* Tên sách hiển thị ngay bên cạnh → alt="" (ngoại lệ alt trong CLAUDE.md) */}
      <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-cover bg-surface-raised sm:w-20">
        {book.cover_url ? (
          <Image src={book.cover_url} alt="" fill sizes="80px" className={cn('object-cover', limit === 0 && 'opacity-40')} />
        ) : (
          <span className="flex h-full items-center justify-center text-subtle">
            <BookIcon aria-hidden className="size-5" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={{ pathname: '/books/[slug]', params: { slug: book.slug } }}
              className="line-clamp-2 rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {book.title}
            </Link>
            {book.authors.length > 0 && (
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{book.authors.join(', ')}</p>
            )}
            <p className="mt-1 text-sm">
              <span className="sr-only">{labels.unitPrice}: </span>
              {formatPrice(book.price)}
              {book.original_price !== null && book.original_price > book.price && (
                <s className="ml-2 text-xs text-subtle">{formatPrice(book.original_price)}</s>
              )}
            </p>
          </div>
          <RemoveButton label={fillTemplate(labels.removeLabel, values)} onClick={() => onRemove(line.book_id)} />
        </div>

        {limit === 0 ? (
          <p className="mt-2 text-sm text-sale">{labels.soldOut}</p>
        ) : (
          line.quantity > book.stock && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-sale">
              {fillTemplate(labels.overStock, values)}
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0"
                onClick={() => onQuantityChange(line.book_id, book.stock)}
              >
                {fillTemplate(labels.reduceTo, values)}
              </Button>
            </p>
          )
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <QuantityStepper
            quantity={line.quantity}
            // Đang vượt tồn kho thì vẫn giảm được; không tăng thêm
            max={Math.max(limit, 1)}
            labels={{
              decrease: fillTemplate(labels.decreaseLabel, values),
              increase: fillTemplate(labels.increaseLabel, values),
              quantity: fillTemplate(labels.quantityLabel, values),
            }}
            onChange={(quantity) => onQuantityChange(line.book_id, quantity)}
          />
          <p className="font-semibold text-primary">
            <span className="sr-only">{labels.lineTotal}: </span>
            {/* Chỉ để hiển thị; tổng tiền luôn lấy từ quote của server */}
            {formatPrice(book.price * line.quantity)}
          </p>
        </div>
      </div>
    </li>
  )
}

function CoverPlaceholder() {
  return (
    <span className="flex aspect-[2/3] w-16 shrink-0 items-center justify-center rounded-cover bg-surface-raised text-subtle sm:w-20">
      <BookIcon aria-hidden className="size-5" />
    </span>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon-lg" className="-mt-1.5 -mr-2 shrink-0 text-muted-foreground" onClick={onClick}>
      <Trash2Icon aria-hidden />
      <span className="sr-only">{label}</span>
    </Button>
  )
}

type StepperProps = {
  quantity: number
  max: number
  labels: { decrease: string; increase: string; quantity: string }
  onChange: (quantity: number) => void
}

function QuantityStepper({ quantity, max, labels, onChange }: StepperProps) {
  // Gõ tay: giữ chuỗi đang gõ, chốt khi rời ô / Enter (gõ "1" để thành "12" không gửi hai lần)
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    if (draft === null) return
    const value = Number.parseInt(draft, 10)
    setDraft(null)
    if (!Number.isNaN(value) && value !== quantity) onChange(Math.min(Math.max(value, 1), Math.max(max, quantity)))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') commit()
  }

  const step = 'size-9 rounded-none text-muted-foreground'

  return (
    <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-input">
      <Button
        variant="ghost"
        className={step}
        aria-label={labels.decrease}
        disabled={quantity <= 1}
        onClick={() => onChange(quantity - 1)}
      >
        <MinusIcon aria-hidden />
      </Button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={Math.max(max, quantity)}
        aria-label={labels.quantity}
        value={draft ?? String(quantity)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className="h-full w-11 border-x border-input bg-transparent text-center text-base tabular-nums sm:text-sm outline-none [appearance:textfield] focus-visible:bg-surface-raised [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Button
        variant="ghost"
        className={step}
        aria-label={labels.increase}
        disabled={quantity >= max}
        onClick={() => onChange(quantity + 1)}
      >
        <PlusIcon aria-hidden />
      </Button>
    </div>
  )
}

type SummaryProps = {
  lines: CartLine[]
  quote: CartQuote
  updating: boolean
  error: string | null
  labels: CartViewLabels
  formatPrice: (value: number) => string
}

function CartSummary({ lines, quote, updating, error, labels, formatPrice }: SummaryProps) {
  const itemCount = lines.reduce((sum, line) => sum + (line.book ? line.quantity : 0), 0)
  const freeShip = freeShipStatus(quote)
  const canCheckout = quote.item_count > 0

  return (
    <section
      aria-labelledby="cart-summary"
      className="h-fit rounded-lg border bg-surface p-5 lg:sticky lg:top-24"
      data-testid="cart-summary"
    >
      <h2 id="cart-summary" className="text-lg font-semibold">
        {labels.summary}
      </h2>

      <div aria-busy={updating} className={cn('transition-opacity duration-200 ease-out', updating && 'opacity-60')}>
        <dl className="mt-4 space-y-2 text-sm">
          <SummaryRow label={labels.itemCount} value={String(itemCount)} />
          <SummaryRow label={labels.subtotal} value={formatPrice(quote.subtotal)} testId="cart-subtotal" />
          <SummaryRow
            label={labels.shipping}
            value={quote.shipping_fee === 0 && quote.item_count > 0 ? labels.freeShipping : formatPrice(quote.shipping_fee)}
            testId="cart-shipping"
          />
          <div className="flex items-baseline justify-between gap-4 border-t pt-3 text-base">
            <dt className="font-semibold">{labels.total}</dt>
            <dd className="font-semibold text-primary" data-testid="cart-total">
              {formatPrice(quote.total)}
            </dd>
          </div>
        </dl>

        {canCheckout && (
          <div className="mt-5">
            <p className="text-sm" data-testid="cart-free-ship">
              {freeShip.reached
                ? labels.freeShipReached
                : fillTemplate(labels.freeShipRemaining, { amount: formatPrice(freeShip.remaining) })}
            </p>
            <div
              role="progressbar"
              aria-label={labels.freeShipProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(freeShip.progress * 100)}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised"
            >
              <div
                className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-250 motion-safe:ease-out"
                style={{ width: `${freeShip.progress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <p role="status" className="mt-3 min-h-5 text-sm">
        {error ? <span className="text-sale"><SupportEmailText text={error} /></span> : updating ? <span className="text-muted-foreground">{labels.updating}</span> : null}
      </p>

      {canCheckout ? (
        <Link href="/checkout" data-chat-avoid className={buttonVariants({ size: 'lg', className: 'mt-2 h-11 w-full text-base' })}>
          <ShoppingBagIcon aria-hidden />
          {labels.checkout}
        </Link>
      ) : (
        <Button size="lg" className="mt-2 h-11 w-full text-base" disabled data-chat-avoid>
          <ShoppingBagIcon aria-hidden />
          {labels.checkout}
        </Button>
      )}
    </section>
  )
}

function SummaryRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums" data-testid={testId}>
        {value}
      </dd>
    </div>
  )
}
