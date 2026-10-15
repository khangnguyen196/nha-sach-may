'use client'

import { unstable_rethrow } from 'next/navigation'
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react'
import type { Failure, Result } from './errors'
import type { FormMessages } from './form-messages'

type FormAction<T> = (prev: Result<T> | null, formData: FormData) => Promise<Result<T>>

const NETWORK_FAILURE: Failure = { ok: false, code: 'UNKNOWN' }

/**
 * useActionState cho form gửi Server Action, giữ progressive enhancement:
 * - Không JS: `formProps.action` là chính Server Action (React render thành URL), trình duyệt POST, server render
 *   lại kèm state. Hook này phải nhận đúng server reference, bọc lại thì mất progressive enhancement.
 * - Có JS: onSubmit tự dispatch (React KHÔNG reset form như mặc định của `<form action>`) qua bản bọc của action:
 *   request không tới / không về được server (mất mạng) thì action ném lỗi → đổi thành UNKNOWN, hiện trong khối
 *   lỗi của form thay vì ném lên error boundary. Lỗi điều hướng của Next (redirect, notFound) vẫn ném tiếp.
 * - Đang gửi thì bỏ qua lần submit mới (double click / Enter lặp). useActionState xếp hàng các lần dispatch
 *   chứ không bỏ, và lần bấm thứ hai có thể tới trước khi nút kịp render `disabled`.
 */
export function useFormAction<T>(action: FormAction<T>, messages: FormMessages) {
  const [serverState, formAction] = useActionState(action, null)
  const [clientState, dispatch, pending] = useActionState<Result<T> | null, FormData>(async (prev, formData) => {
    try {
      return await action(prev, formData)
    } catch (error) {
      unstable_rethrow(error)
      console.error('useFormAction:', error)
      return NETWORK_FAILURE
    }
  }, null)
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

  const state = clientState ?? serverState
  const failure = state && !state.ok ? state : null
  const fieldKeys = failure?.fieldErrors

  return {
    state,
    pending,
    formProps: { action: formAction, onSubmit },
    /** Lỗi chung; có lỗi tại ô (nhập liệu, VD SLUG_TAKEN của admin) thì `quiet` (lỗi đã hiện ở từng ô) */
    formError: failure ? (messages.errors[failure.code] ?? messages.errors.UNKNOWN) : undefined,
    quietError: fieldKeys !== undefined && Object.keys(fieldKeys).length > 0,
    fieldError(name: string) {
      const key = fieldKeys?.[name]
      return key ? (messages.validation[key] ?? messages.validation.invalid) : undefined
    },
  }
}
