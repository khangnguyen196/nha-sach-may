'use client'

import type { AllHTMLAttributes, ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'
import { useHydrated } from '@/lib/use-hydrated'
import { Button } from './button'

// Firefox giữ trạng thái disabled của <button> qua lần tải lại (MDN) → nút có thể bật sẵn trước hydrate. autocomplete trên
// <button> là thuộc tính phi chuẩn (chỉ Firefox dùng, trình kiểm HTML báo), nên type <button> của React không có autoComplete
const NO_STATE_RESTORE: Pick<AllHTMLAttributes<HTMLButtonElement>, 'autoComplete'> = { autoComplete: 'off' }

type Props = Omit<ComponentProps<typeof Button>, 'type' | 'aria-disabled'> & {
  pendingLabel: string
  /** Truyền vào khi form tự dispatch (useFormAction): useFormStatus chỉ theo dõi `<form action>` */
  pending?: boolean
  /** `ready` của useFormAction: false (chưa hydrate) → khóa nút */
  ready?: boolean
  /** Form `<form action>` thường không qua useFormAction (VD sổ địa chỉ): tự khóa tới khi hydrate */
  lockUntilHydrated?: boolean
}

/**
 * Nút gửi form: khóa và đổi nhãn khi đang gửi. Khóa (giữ chữ) khi chưa hydrate nếu form báo (`ready` /
 * `lockUntilHydrated`): gửi lúc đó (tắt JS, 4G chậm) là POST thường, action trả kết quả thì ra trang trắng
 * (docs/plans/no-js.md, ★8). `disabled` truyền vào được gộp với các điều kiện trên, `aria-disabled` luôn khớp `disabled`.
 */
export function SubmitButton({
  children,
  pendingLabel,
  pending: pendingProp,
  ready = true,
  lockUntilHydrated = false,
  disabled = false,
  ...props
}: Props) {
  const status = useFormStatus()
  const hydrated = useHydrated()
  const pending = pendingProp ?? status.pending
  const off = pending || disabled || !ready || (lockUntilHydrated && !hydrated)
  return (
    <Button type="submit" {...props} {...NO_STATE_RESTORE} disabled={off} aria-disabled={off}>
      {pending ? pendingLabel : children}
    </Button>
  )
}
