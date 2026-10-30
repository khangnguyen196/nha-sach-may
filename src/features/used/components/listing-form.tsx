'use client'

import { useRef, useState } from 'react'
import { SignInAgainLink } from '@/components/layout/sign-in-again-link'
import { buttonVariants } from '@/components/ui/button'
import { FormAlert, TextAreaField, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Link } from '@/i18n/navigation'
import { formats } from '@/i18n/formats'
import type { Result } from '@/lib/errors'
import { fillTemplate } from '@/lib/template'
import { useFormAction } from '@/lib/use-form-action'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import type { ListingBookOption, UploadedPhoto } from '../actions'
import type { ListingFormProps } from '../form-props'
import { BookPicker } from './book-picker'
import { PhotoPicker, type PhotoItem } from './photo-picker'

type Condition = Database['public']['Enums']['used_condition']
type Quote = { fee: number; payout: number }
type QuoteState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; quote: Quote } | { status: 'error' }

/** = check của bảng used_listings (mô tả ≤ 500) */
const DESCRIPTION_MAX = 500
const QUOTE_DELAY_MS = 400
/** Số nguyên dương, chỉ chữ số (như schema của server); lớn hơn int4 thì không hỏi phí */
const PRICE_DIGITS = /^\d{1,10}$/
const INT4_MAX = 2_147_483_647

type Props = ListingFormProps & {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  uploadPhoto: (formData: FormData) => Promise<Result<UploadedPhoto>>
  deletePhoto: (path: string) => Promise<Result<null>>
  quote: (price: number) => Promise<Result<Quote>>
  /** Chỉ form đăng tin: sửa tin không đổi sách */
  searchBooks?: (q: string) => Promise<Result<ListingBookOption[]>>
  initial: {
    book: ListingBookOption | null
    condition: Condition | null
    price: string
    description: string
    photos: UploadedPhoto[]
    /** Sửa tin: số tiền nhận của giá đang lưu (server tính sẵn) */
    quote: Quote | null
  }
}

function parsePrice(value: string) {
  const trimmed = value.trim()
  if (!PRICE_DIGITS.test(trimmed)) return null
  const price = Number(trimmed)
  return price > 0 && price <= INT4_MAX ? price : null
}

/**
 * Form đăng / sửa tin sách cũ (client leaf: không zod, không supabase-js; mọi kiểm tra thật ở Server Action + RPC).
 * "Bạn nhận được" lấy từ RPC used_listing_quote (client không tự tính phí).
 */
export function ListingForm({
  action,
  uploadPhoto,
  deletePhoto,
  quote,
  searchBooks,
  initial,
  locale,
  messages,
  labels,
  conditions,
}: Props) {
  const { formProps, pending, ready, formError, quietError, fieldError, signIn } = useFormAction(action, messages)
  const [book, setBook] = useState(initial.book)
  const [price, setPrice] = useState(initial.price)
  const [quoteState, setQuoteState] = useState<QuoteState>(
    initial.quote ? { status: 'done', quote: initial.quote } : { status: 'idle' },
  )
  const [description, setDescription] = useState(initial.description)
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    initial.photos.map((photo, index) => ({ key: -1 - index, ...photo, uploading: false, saved: true })),
  )
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef(0)
  const formatPrice = new Intl.NumberFormat(locale, formats.number.price).format
  const uploading = photos.some((photo) => photo.uploading)

  function changePrice(value: string) {
    setPrice(value)
    clearTimeout(timer.current)
    const request = ++latest.current
    const amount = parsePrice(value)
    if (amount === null) {
      setQuoteState({ status: 'idle' })
      return
    }
    setQuoteState({ status: 'loading' })
    timer.current = setTimeout(async () => {
      let result: Result<Quote>
      try {
        result = await quote(amount)
      } catch {
        result = { ok: false, code: 'NETWORK_ERROR' }
      }
      if (request !== latest.current) return
      setQuoteState(result.ok ? { status: 'done', quote: result.data } : { status: 'error' })
    }, QUOTE_DELAY_MS)
  }

  const priceHint = book ? fillTemplate(labels.priceHint, { max: formatPrice(book.maxPrice) }) : labels.priceHintNoBook
  const payoutText =
    quoteState.status === 'done'
      ? fillTemplate(labels.payout, { payout: formatPrice(quoteState.quote.payout), fee: formatPrice(quoteState.quote.fee) })
      : quoteState.status === 'loading'
        ? labels.quoting
        : quoteState.status === 'error'
          ? labels.quoteError
          : ''

  return (
    <form {...formProps} noValidate className="grid gap-6">
      {formError && (
        <FormAlert quiet={quietError} action={signIn && <SignInAgainLink signIn={signIn} />}>
          {formError}
        </FormAlert>
      )}

      <BookPicker
        book={book}
        onChange={setBook}
        searchBooks={searchBooks}
        labels={labels}
        formatPrice={formatPrice}
        error={fieldError('book_id')}
        // Tìm sách / tải ảnh chỉ chạy bằng JS: khóa tới khi hydrate (chọn file trước đó thì không tải lên)
        disabled={pending || !ready}
      />

      <fieldset className="grid gap-2" aria-describedby={fieldError('condition') ? 'listing-condition-error' : undefined}>
        <legend className="text-sm font-medium">{labels.condition}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {conditions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer gap-3 rounded-lg border bg-surface p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-focus-ring hover:bg-surface-raised"
            >
              <input
                type="radio"
                name="condition"
                value={option.value}
                defaultChecked={option.value === initial.condition}
                disabled={pending}
                className="mt-1 size-4 shrink-0 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {fieldError('condition') && (
          <p id="listing-condition-error" className="text-sm text-destructive">
            {fieldError('condition')}
          </p>
        )}
      </fieldset>

      <div className="grid gap-1.5">
        <TextField
          name="price"
          label={labels.price}
          value={price}
          onChange={(event) => changePrice(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          required
          hint={priceHint}
          error={fieldError('price')}
          readOnly={pending}
          className="tabular-nums sm:max-w-60"
        />
        <p
          role="status"
          className={cn('text-sm', quoteState.status === 'done' ? 'font-medium text-foreground' : 'text-muted-foreground')}
          data-testid="listing-payout"
        >
          {payoutText}
        </p>
      </div>

      <TextAreaField
        name="description"
        label={labels.description}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={DESCRIPTION_MAX}
        rows={4}
        hint={`${labels.descriptionHint} ${fillTemplate(labels.counter, { count: description.length })}`}
        error={fieldError('description')}
        readOnly={pending}
      />

      <PhotoPicker
        photos={photos}
        onChange={setPhotos}
        uploadPhoto={uploadPhoto}
        deletePhoto={deletePhoto}
        labels={labels}
        messages={messages}
        error={fieldError('photos')}
        disabled={pending || !ready}
      />

      <div className="flex flex-wrap gap-3 pt-2">
        <SubmitButton
          pending={pending}
          ready={ready}
          disabled={uploading}
          pendingLabel={labels.pending}
          size="lg"
          className="h-11 px-5"
        >
          {searchBooks ? labels.submitCreate : labels.submitEdit}
        </SubmitButton>
        <Link
          href="/account/my-listings"
          className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'h-11 px-5' })}
        >
          {labels.cancel}
        </Link>
      </div>
    </form>
  )
}
