import type { ComponentProps } from 'react'

/** Ô chọn có nhãn + gợi ý. Form gửi `name=on` khi chọn, không gửi gì khi bỏ chọn (schema đọc thành boolean). */
export function CheckboxField({
  name,
  label,
  hint,
  ...props
}: { name: string; label: string; hint?: string } & Omit<ComponentProps<'input'>, 'id' | 'name' | 'type'>) {
  const id = `field-${name}`
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 size-5 shrink-0 accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        {...props}
      />
      <div className="grid gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}
