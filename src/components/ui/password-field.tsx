'use client'

import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { useHydrated } from '@/lib/use-hydrated'
import { control, FieldShell, ids, type TextField } from './field'

type Props = Omit<ComponentProps<typeof TextField>, 'type' | 'ref'> & {
  /** Nhãn của nút (dịch ở server): "Hiện mật khẩu" / "Ẩn mật khẩu" */
  labels: { show: string; hide: string }
}

/**
 * Ô mật khẩu có nút hiện / ẩn. Ô không kiểm soát giá trị (chữ gõ trước hydrate giữ nguyên); `pr-12` có sẵn từ server
 * nên ô không đổi kích thước khi nút xuất hiện. Nút chỉ render sau hydrate: trước đó (hoặc tắt JS) bấm không làm gì.
 */
export function PasswordField({ name, label, error, hint, idPrefix, labelAside, className, labels, ...props }: Props) {
  const field = { name, label, error, hint, idPrefix, labelAside }
  const { id, describedBy } = ids(field)
  const hydrated = useHydrated()
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Gửi form khi đang hiện → về type password ngay, đồng bộ, trước khi trình duyệt / trình quản lý mật khẩu đọc ô và
  // trước onSubmit của React (React nghe ở root, listener trên form chạy trước).
  useEffect(() => {
    const input = inputRef.current
    const form = input?.form
    if (!input || !form) return
    const hide = () => {
      input.type = 'password'
      setVisible(false)
    }
    form.addEventListener('submit', hide, true)
    return () => form.removeEventListener('submit', hide, true)
  }, [])

  return (
    <FieldShell field={field} id={id}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(control, 'pr-12', className)}
          {...props}
        />
        {hydrated && (
          <button
            type="button"
            aria-pressed={visible}
            aria-controls={id}
            aria-label={visible ? labels.hide : labels.show}
            onClick={() => setVisible((value) => !value)}
            className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-focus-ring"
          >
            {/* Vẽ thẳng hình Eye / EyeOff của lucide (như chevron trong field.tsx): import lucide ở client leaf thêm
                createLucideIcon + module icon vào bundle trang đăng nhập / đăng ký (CLAUDE.md → Hiệu năng) */}
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              {visible ? (
                <>
                  <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                  <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                  <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                  <path d="m2 2 20 20" />
                </>
              ) : (
                <>
                  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>
    </FieldShell>
  )
}
