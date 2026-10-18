import { ChevronDownIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { SupportEmailText } from '@/components/layout/support-email-text'
import { cn } from '@/lib/utils'

// Không có 'use client' và không dùng hook → dùng được cả trong Server Component lẫn form client.
// id suy từ `name` (+ `idPrefix` khi một trang có hai form trùng tên ô).

const control =
  'h-11 w-full rounded-md border border-input bg-surface px-3 text-base text-foreground transition-colors outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/20'

type FieldOwnProps = {
  name: string
  label: string
  error?: string
  hint?: string
  idPrefix?: string
  /** Nội dung cạnh nhãn, VD link "Quên mật khẩu?" */
  labelAside?: ReactNode
}

function ids({ name, idPrefix, error, hint }: FieldOwnProps) {
  const id = `${idPrefix ?? 'field'}-${name}`
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
  return { id, describedBy }
}

function FieldShell({ field, id, children }: { field: FieldOwnProps; id: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {field.label}
        </label>
        {field.labelAside}
      </div>
      {children}
      {field.hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {field.hint}
        </p>
      )}
      {field.error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {field.error}
        </p>
      )}
    </div>
  )
}

export function TextField({
  name,
  label,
  error,
  hint,
  idPrefix,
  labelAside,
  className,
  ...props
}: FieldOwnProps & Omit<ComponentProps<'input'>, 'id' | 'name'>) {
  const field = { name, label, error, hint, idPrefix, labelAside }
  const { id, describedBy } = ids(field)
  return (
    <FieldShell field={field} id={id}>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(control, className)}
        {...props}
      />
    </FieldShell>
  )
}

export function SelectField({
  name,
  label,
  error,
  hint,
  idPrefix,
  labelAside,
  className,
  children,
  ...props
}: FieldOwnProps & Omit<ComponentProps<'select'>, 'id' | 'name'>) {
  const field = { name, label, error, hint, idPrefix, labelAside }
  const { id, describedBy } = ids(field)
  return (
    <FieldShell field={field} id={id}>
      <div className="relative">
        <select
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(control, 'appearance-none pr-9', className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDownIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </FieldShell>
  )
}

export function TextAreaField({
  name,
  label,
  error,
  hint,
  idPrefix,
  labelAside,
  className,
  ...props
}: FieldOwnProps & Omit<ComponentProps<'textarea'>, 'id' | 'name'>) {
  const field = { name, label, error, hint, idPrefix, labelAside }
  const { id, describedBy } = ids(field)
  return (
    <FieldShell field={field} id={id}>
      <textarea
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(control, 'h-auto min-h-24 resize-y py-2.5 leading-relaxed', className)}
        {...props}
      />
    </FieldShell>
  )
}

/**
 * Lỗi chung của form. `quiet`: chỉ đọc cho trình đọc màn hình (đã có lỗi hiện tại từng ô).
 * Chuỗi có email liên hệ (UNKNOWN, đơn đã thanh toán…) → email thành link mailto.
 */
export function FormAlert({ children, quiet = false, action }: { children: ReactNode; quiet?: boolean; action?: ReactNode }) {
  return (
    <p
      role="alert"
      className={
        quiet
          ? 'sr-only'
          : 'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive'
      }
    >
      {typeof children === 'string' ? <SupportEmailText text={children} /> : children}
      {action && <> {action}</>}
    </p>
  )
}
