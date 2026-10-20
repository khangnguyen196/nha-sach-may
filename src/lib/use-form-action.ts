'use client'

import { unstable_rethrow } from 'next/navigation'
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react'
import type { Failure, Result } from './errors'
import type { FormMessages } from './form-messages'
import { useHydrated } from './use-hydrated'

type FormAction<T> = (prev: Result<T> | null, formData: FormData) => Promise<Result<T>>

const NETWORK_FAILURE: Failure = { ok: false, code: 'NETWORK_ERROR' }

// Phiên hết giữa chừng → kèm link đăng nhập lại (nếu trang truyền signInNext)
const SIGN_IN_CODES = new Set(['AUTH_REQUIRED', 'SESSION_EXPIRED'])

/**
 * useActionState cho form gửi Server Action:
 * - `ready`: false tới khi React hydrate xong → nút gửi (`SubmitButton ready={ready}`) khóa `disabled` + `aria-disabled`,
 *   giữ nguyên chữ. Gửi khi tắt JS / trước hydrate là POST thường: server chỉ trả phần động (Cache Components) → trang
 *   trắng dù action đã chạy (docs/plans/no-js.md, ★8, vercel/next.js#99756). Khóa nút thì không gửi được thay vì trắng.
 * - `formProps.action` vẫn là chính Server Action (React render thành URL): hook phải nhận đúng server reference.
 * - Có JS: onSubmit tự dispatch (React KHÔNG reset form như mặc định của `<form action>`) qua bản bọc của action:
 *   request không tới / không về được server (mất mạng) thì action ném lỗi → đổi thành NETWORK_ERROR, hiện trong khối
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
  const ready = useHydrated()

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
    /** Đã hydrate: trước đó nút gửi khóa (gửi lúc này là POST thường → trang trắng) */
    ready,
    formProps: { action: formAction, onSubmit },
    /**
     * Lỗi chung; có lỗi tại ô (nhập liệu, VD SLUG_TAKEN của admin) thì `quiet` (lỗi đã hiện ở từng ô).
     * Action đã dịch sẵn (câu có tham số, VD RATE_LIMITED kèm số giây) → dùng `message`.
     */
    formError: failure ? (failure.message ?? messages.errors[failure.code] ?? messages.errors.UNKNOWN) : undefined,
    quietError: fieldKeys !== undefined && Object.keys(fieldKeys).length > 0,
    /** Link "Đăng nhập lại" cho khối lỗi chung (FormAlert `action`) */
    signIn: failure && SIGN_IN_CODES.has(failure.code) ? messages.signIn : undefined,
    fieldError(name: string) {
      const key = fieldKeys?.[name]
      return key ? (messages.validation[key] ?? messages.validation.invalid) : undefined
    },
  }
}
