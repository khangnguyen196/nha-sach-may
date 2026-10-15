'use client'

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react'
import type { Result } from './errors'
import type { FormMessages } from './form-messages'

/**
 * useActionState cho form gửi Server Action, giữ progressive enhancement:
 * - Không JS: `action` là URL của Server Action, trình duyệt POST, server render lại kèm state.
 * - Có JS: onSubmit tự dispatch để React KHÔNG reset form sau khi action chạy xong (mặc định của `<form action>`),
 *   nhờ vậy lỗi hiện tại chỗ mà người dùng không mất những gì đã nhập.
 * - Đang gửi thì bỏ qua lần submit mới (double click / Enter lặp). useActionState xếp hàng các lần dispatch
 *   chứ không bỏ, và lần bấm thứ hai có thể tới trước khi nút kịp render `disabled`.
 */
export function useFormAction<T>(
  action: (prev: Result<T> | null, formData: FormData) => Promise<Result<T>>,
  messages: FormMessages,
) {
  const [state, dispatch, pending] = useActionState(action, null)
  const submitting = useRef(false)

  useEffect(() => {
    if (!pending) submitting.current = false
  }, [pending])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null
    const formData = new FormData(event.currentTarget, submitter)
    startTransition(() => dispatch(formData))
  }

  const failure = state && !state.ok ? state : null
  const fieldKeys = failure?.fieldErrors

  return {
    state,
    pending,
    formProps: { action: dispatch, onSubmit },
    /** Lỗi chung; với lỗi nhập liệu thì `quiet` (lỗi đã hiện ở từng ô) */
    formError: failure ? (messages.errors[failure.code] ?? messages.errors.UNKNOWN) : undefined,
    quietError: failure?.code === 'INVALID_INPUT' && fieldKeys !== undefined && Object.keys(fieldKeys).length > 0,
    fieldError(name: string) {
      const key = fieldKeys?.[name]
      return key ? (messages.validation[key] ?? messages.validation.invalid) : undefined
    },
  }
}
