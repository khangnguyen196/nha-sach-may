'use client'

import type { ComponentProps } from 'react'
import { SignInAgainLink } from '@/components/layout/sign-in-again-link'
import { FormAlert } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Link } from '@/i18n/navigation'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'

type Props = {
  /** blockItem / unblockItem đã bind locale + mục */
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  label: string
  /** Tên đọc được khi chữ hiển thị không đủ nghĩa (VD "Bỏ chặn" → "Bỏ chặn tác giả «…»"), chứa chữ hiển thị */
  accessibleLabel?: string
  pendingLabel: string
  /** Chữ link tới trang Sở thích, hiện kèm lỗi PREFS_LIMIT (đủ 50 mục) */
  prefsLink: string
  variant: ComponentProps<typeof SubmitButton>['variant']
  size: ComponentProps<typeof SubmitButton>['size']
  className?: string
}

/**
 * Một nút chặn / bỏ chặn ở trang sách và trang Sở thích: một form, useFormAction (nút khóa tới khi hydrate, mất mạng →
 * NETWORK_ERROR). Thành công: action gọi refresh() → server render lại (nút này thường biến mất). Lỗi hiện ngay dưới
 * nút; phiên hết → link "Đăng nhập lại", đủ 50 mục → link trang Sở thích. Không Radix / lucide / zod.
 */
export function PrefsButton({
  action,
  messages,
  label,
  accessibleLabel,
  pendingLabel,
  prefsLink,
  variant,
  size,
  className,
}: Props) {
  const { formProps, pending, ready, state, formError, signIn } = useFormAction(action, messages)
  const limitReached = state?.ok === false && state.code === 'PREFS_LIMIT'
  const alertAction = signIn ? (
    <SignInAgainLink signIn={signIn} />
  ) : limitReached ? (
    <Link
      href="/account/preferences"
      className="rounded-sm font-medium whitespace-nowrap underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {prefsLink}
    </Link>
  ) : undefined

  return (
    <form {...formProps} className="grid justify-items-start gap-2">
      <SubmitButton
        pending={pending}
        ready={ready}
        pendingLabel={pendingLabel}
        aria-label={pending ? undefined : accessibleLabel}
        variant={variant}
        size={size}
        className={className}
      >
        {label}
      </SubmitButton>
      {formError && <FormAlert action={alertAction}>{formError}</FormAlert>}
    </form>
  )
}
