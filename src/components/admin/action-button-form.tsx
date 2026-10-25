'use client'

import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { FormAlert } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'
import { cn } from '@/lib/utils'

type Props<T> = {
  action: (prev: Result<T> | null, formData: FormData) => Promise<Result<T>>
  messages: FormMessages
  label: string
  pendingLabel: string
  variant?: ComponentProps<typeof Button>['variant']
  /** Nhãn dài trong cột hẹp: cho nút xuống dòng (VD `h-auto min-h-11 py-2 whitespace-normal`) */
  buttonClassName?: string
}

/**
 * Form chỉ có một nút (ẩn / hiện sách, xóa tác giả, gợi ý cảnh báo một cuốn): lỗi hiện ngay trên nút; nút khóa tới khi
 * hydrate (useFormAction). Dữ liệu action trả về không dùng (trang tự làm mới bằng refresh()).
 */
export function ActionButtonForm<T>({
  action,
  messages,
  label,
  pendingLabel,
  variant = 'outline',
  buttonClassName,
}: Props<T>) {
  const { formProps, pending, ready, formError } = useFormAction(action, messages)
  return (
    <form {...formProps} className="grid justify-items-start gap-3">
      {formError && <FormAlert>{formError}</FormAlert>}
      <SubmitButton
        pending={pending}
        ready={ready}
        pendingLabel={pendingLabel}
        variant={variant}
        size="lg"
        className={cn('h-11 px-5', buttonClassName)}
      >
        {label}
      </SubmitButton>
    </form>
  )
}
