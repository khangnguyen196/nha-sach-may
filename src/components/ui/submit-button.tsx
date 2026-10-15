'use client'

import type { ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from './button'

/**
 * Nút gửi form: khóa và đổi nhãn khi đang gửi. Không JS thì là nút submit thường.
 * `pending` truyền vào khi form tự dispatch (useFormAction): useFormStatus chỉ theo dõi `<form action>`.
 */
export function SubmitButton({
  children,
  pendingLabel,
  pending: pendingProp,
  ...props
}: Omit<ComponentProps<typeof Button>, 'type'> & { pendingLabel: string; pending?: boolean }) {
  const status = useFormStatus()
  const pending = pendingProp ?? status.pending
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  )
}
