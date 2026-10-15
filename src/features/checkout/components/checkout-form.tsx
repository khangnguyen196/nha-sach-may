'use client'

import { ShoppingBagIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FormAlert, TextAreaField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Link } from '@/i18n/navigation'
import type { ErrorCode, Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { fillTemplate } from '@/lib/template'
import { useFormAction } from '@/lib/use-form-action'
import { useGuestCart } from '@/features/cart/store'

/** Chuỗi đã dịch từ server; `{count}` của noteCount điền ở client */
export type CheckoutFormLabels = {
  noteLabel: string
  noteHint: string
  noteCount: string
  placeOrder: string
  placing: string
  syncingCart: string
  fixQuantity: string
  fixRemove: string
  chooseAddress: string
}

type Props = {
  /** placeOrder đã bind locale; thành công thì redirect sang trang đặt hàng thành công */
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: CheckoutFormLabels
  /** Sinh mỗi lần render ở server (phần động); gửi lại cùng key → place_order trả đúng đơn đã tạo */
  idempotencyKey: string
  /** Tổng đang hiển thị, chỉ để place_order so sánh */
  expectedTotal: number
  /** Mã voucher đã áp dụng (hợp lệ) trên trang; null = không voucher */
  voucherCode: string | null
  noteMax: number
  /** Server đã biết không đặt được: chưa có địa chỉ, giỏ có dòng hết hàng / ngừng bán */
  blocked: boolean
  /** Server Component: nhóm radio địa chỉ (id="checkout-address") */
  address: ReactNode
  payment: ReactNode
  summary: ReactNode
  /** Ô mã giảm giá (thuộc form GET riêng qua thuộc tính `form`) */
  voucher: ReactNode
  /** Cảnh báo giỏ có vấn đề, hiện trên nút */
  problems?: ReactNode
}

/** Một hành động sửa cho mỗi mã lỗi (bảng "Mã lỗi → UI" trong docs/plans/phase-5b.md) */
function FixAction({ code, labels }: { code: ErrorCode; labels: CheckoutFormLabels }) {
  const className = 'mt-1.5 block w-fit font-medium underline underline-offset-4 hover:text-foreground'
  if (code === 'OUT_OF_STOCK' || code === 'BOOK_UNAVAILABLE') {
    return (
      <Link href="/cart" className={className}>
        {code === 'OUT_OF_STOCK' ? labels.fixQuantity : labels.fixRemove}
      </Link>
    )
  }
  if (code === 'INVALID_ADDRESS') {
    return (
      <a href="#checkout-address" className={className}>
        {labels.chooseAddress}
      </a>
    )
  }
  return null
}

/**
 * Client leaf duy nhất của trang thanh toán: ghi chú (bộ đếm), nút đặt hàng, khối lỗi. Địa chỉ, thanh toán,
 * tóm tắt là Server Component truyền vào qua props. Không JS vẫn đặt được (radio + textarea gốc).
 */
export function CheckoutForm({
  action,
  messages,
  labels,
  idempotencyKey,
  expectedTotal,
  voucherCode,
  noteMax,
  blocked,
  address,
  payment,
  summary,
  voucher,
  problems,
}: Props) {
  const { state, formProps, pending, formError, fieldError } = useFormAction(action, messages)
  const [noteLength, setNoteLength] = useState(0)
  const alertRef = useRef<HTMLDivElement>(null)
  // Giỏ khách chưa gộp xong (vừa đăng nhập từ trang giỏ): trang đang thiếu sách → chờ CartSync gộp + refresh
  const syncing = useGuestCart().length > 0

  const failure = state && !state.ok ? state : null
  const noteError = fieldError('note')
  // Lỗi ghi chú hiện tại ô; lỗi nhập liệu khác (địa chỉ, field ẩn bị sửa) không có ô riêng → hiện ở khối lỗi
  const alert = noteError ? undefined : (failure?.message ?? fieldError('address_id') ?? formError)

  // Focus vào khối lỗi để trình đọc màn hình đọc ngay (khối lỗi nằm ở cột phải, xa chỗ bấm trên mobile)
  useEffect(() => {
    if (failure) alertRef.current?.focus()
  }, [failure])

  return (
    <form {...formProps} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <input type="hidden" name="expected_total" value={expectedTotal} />
      {voucherCode && <input type="hidden" name="voucher_code" value={voucherCode} />}

      <div className="grid content-start gap-10">
        {address}
        <TextAreaField
          name="note"
          label={labels.noteLabel}
          hint={labels.noteHint}
          labelAside={
            <span className="text-xs text-subtle tabular-nums">
              {fillTemplate(labels.noteCount, { count: noteLength })}
            </span>
          }
          maxLength={noteMax}
          rows={3}
          onChange={(event) => setNoteLength(event.target.value.length)}
          error={noteError}
        />
        {payment}
      </div>

      <aside className="h-fit rounded-lg border bg-surface p-5 lg:sticky lg:top-24" data-testid="checkout-summary">
        {summary}
        {voucher}
        {problems}
        {alert && failure && (
          <div ref={alertRef} tabIndex={-1} className="mt-4 outline-none" data-testid="checkout-error">
            <FormAlert>
              {alert}
              <FixAction code={failure.code} labels={labels} />
            </FormAlert>
          </div>
        )}
        <p role="status" className="mt-3 min-h-5 text-sm text-muted-foreground">
          {syncing && !blocked ? labels.syncingCart : null}
        </p>
        <SubmitButton
          pending={pending}
          pendingLabel={labels.placing}
          disabled={pending || blocked || syncing}
          aria-disabled={pending || blocked || syncing}
          size="lg"
          className="mt-2 h-11 w-full text-base"
        >
          <ShoppingBagIcon aria-hidden />
          {labels.placeOrder}
        </SubmitButton>
      </aside>
    </form>
  )
}
