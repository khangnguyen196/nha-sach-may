'use client'

import { useEffect, useRef, type ComponentProps } from 'react'
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
  /**
   * id các phần tử ổn định (tabIndex={-1}) theo thứ tự ưu tiên: phần tử đầu tiên còn trong trang nhận focus khi nút này
   * bị gỡ sau khi thành công (refresh() render lại không còn nút) → focus không rơi về body (WCAG 2.4.3)
   */
  focusAfterIds: readonly string[]
  variant: ComponentProps<typeof SubmitButton>['variant']
  size: ComponentProps<typeof SubmitButton>['size']
  className?: string
}

/**
 * Một nút chặn / bỏ chặn ở trang sách và trang Sở thích: một form, useFormAction (nút khóa tới khi hydrate, mất mạng →
 * NETWORK_ERROR). Thành công: action gọi refresh() → server render lại (nút này thường biến mất). Lỗi hiện ngay dưới
 * nút; phiên hết → link "Đăng nhập lại", đủ 50 mục → link trang Sở thích. Không Radix / lucide / zod.
 * Thành công rồi nút bị gỡ → focus `focusAfterIds` (cùng cách với WithdrawButton của chợ sách cũ).
 */
export function PrefsButton({
  action,
  messages,
  label,
  accessibleLabel,
  pendingLabel,
  prefsLink,
  focusAfterIds,
  variant,
  size,
  className,
}: Props) {
  const { formProps, pending, ready, state, formError, signIn } = useFormAction(action, messages)
  const limitReached = state?.ok === false && state.code === 'PREFS_LIMIT'
  // Đã gửi và chưa báo lỗi: action thành công gọi refresh(), kết quả + cây mới của server tới cùng một lần commit nên nút
  // có thể bị gỡ mà chưa từng render với state ok → dựa vào "đang / vừa gửi" thay vì state. Lỗi không refresh (nút còn).
  const submitted = useRef(false)
  useEffect(() => {
    if (pending) submitted.current = true
    else if (state?.ok === false) submitted.current = false
  }, [pending, state])

  // Cleanup chạy khi nút bị gỡ (sau khi DOM mới đã gắn): phần tử đích đã mang nội dung mới (VD dòng nhắc). Chỉ khi focus
  // đã rơi về body (nút vừa rời DOM): người dùng chuyển focus đi chỗ khác trong lúc gửi thì không kéo về
  const focusKey = focusAfterIds.join(' ')
  useEffect(
    () => () => {
      if (!submitted.current) return
      if (document.activeElement !== null && document.activeElement !== document.body) return
      for (const id of focusKey.split(' ')) {
        const target = document.getElementById(id)
        if (target) {
          target.focus()
          return
        }
      }
    },
    [focusKey],
  )

  const alertAction = signIn ? (
    <SignInAgainLink signIn={signIn} />
  ) : limitReached ? (
    <Link
      href="/account/preferences"
      prefetch={false}
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
