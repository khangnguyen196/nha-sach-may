'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SignInAgainLink } from '@/components/layout/sign-in-again-link'
import { FormAlert, TextAreaField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { fillTemplate } from '@/lib/template'
import { useFormAction } from '@/lib/use-form-action'

/** Chuỗi đã dịch từ server; `{count}` của noteCount điền ở client */
export type UsedOrderFormLabels = {
  noteLabel: string
  noteHint: string
  noteCount: string
  placeOrder: string
  placing: string
  chooseAddress: string
}

type Props = {
  /** placeUsedOrder đã bind locale + id tin; thành công thì redirect sang trang đặt hàng thành công */
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: UsedOrderFormLabels
  /** Sinh mỗi lần render ở server (phần động); gửi lại cùng key → place_used_order trả đúng đơn đã tạo */
  idempotencyKey: string
  /** Tổng đang hiển thị (quote_used_order), chỉ để RPC so */
  expectedTotal: number
  /** `updated_at` của bản tin đang hiển thị, nguyên chuỗi PostgREST (RPC so sau khi khóa tin) */
  expectedUpdatedAt: string
  noteMax: number
  /** Chưa có địa chỉ nào → không đặt được */
  blocked: boolean
  /** Server Component: nhóm radio địa chỉ (id="checkout-address") */
  address: ReactNode
  payment: ReactNode
  /** Tóm tắt tin + tiền + ghi chú demo (Server Component) */
  summary: ReactNode
  /** Icon của nút đặt (Server Component render, không import lucide ở client) */
  placeIcon: ReactNode
}

/**
 * Client leaf của trang mua một tin: ghi chú (bộ đếm), nút đặt, khối lỗi. Địa chỉ, thanh toán, tóm tắt là Server
 * Component truyền vào qua props. Không dùng nháp sessionStorage như /thanh-toan: trang mua không có form GET nào tải
 * lại trang; lỗi của action không reset form (useFormAction) nên ghi chú đã gõ còn nguyên.
 */
export function UsedOrderForm({
  action,
  messages,
  labels,
  idempotencyKey,
  expectedTotal,
  expectedUpdatedAt,
  noteMax,
  blocked,
  address,
  payment,
  summary,
  placeIcon,
}: Props) {
  const { state, formProps, pending, ready, formError, fieldError, signIn } = useFormAction(action, messages)
  const [noteLength, setNoteLength] = useState(0)
  const alertRef = useRef<HTMLDivElement>(null)

  const failure = state && !state.ok ? state : null
  const noteError = fieldError('note')
  // Lỗi ghi chú hiện tại ô; lỗi nhập liệu khác (địa chỉ, ô ẩn bị sửa) không có ô riêng → khối lỗi
  const alert = noteError ? undefined : (fieldError('address_id') ?? formError)

  // Focus vào khối lỗi để trình đọc màn hình đọc ngay (khối lỗi ở cột phải, xa chỗ bấm trên mobile)
  useEffect(() => {
    if (failure) alertRef.current?.focus()
  }, [failure])

  return (
    <form {...formProps} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <input type="hidden" name="expected_total" value={expectedTotal} />
      <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />

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

      <aside className="h-fit rounded-lg border bg-surface p-5 lg:sticky lg:top-24" data-testid="used-order-summary">
        {summary}
        {alert && failure && (
          <div ref={alertRef} tabIndex={-1} className="mt-4 outline-none" data-testid="used-order-error">
            <FormAlert action={signIn && <SignInAgainLink signIn={signIn} />}>
              {alert}
              {failure.code === 'INVALID_ADDRESS' && (
                <a
                  href="#checkout-address"
                  className="mt-1.5 block w-fit font-medium underline underline-offset-4 hover:text-foreground"
                >
                  {labels.chooseAddress}
                </a>
              )}
            </FormAlert>
          </div>
        )}
        {/* data-chat-avoid: phòng khi bong bóng chat hiện ở trang này (trang mua đang ẩn chat) */}
        <SubmitButton
          pending={pending}
          ready={ready}
          pendingLabel={labels.placing}
          disabled={blocked}
          size="lg"
          className="mt-5 h-11 w-full text-base"
          data-chat-avoid
        >
          {placeIcon}
          {labels.placeOrder}
        </SubmitButton>
      </aside>
    </form>
  )
}
