import type { ContentWarning } from '@/features/warnings/labels'

export type WarningLabelOption = { value: ContentWarning; label: string }

type Props = {
  /** Tên ô trong FormData (lặp lại mỗi nhãn được chọn: FormData.getAll) */
  name: string
  legend: string
  hint?: string
  options: readonly WarningLabelOption[]
  defaultValue: readonly ContentWarning[]
  error?: string
}

/**
 * 5 ô chọn nhãn cảnh báo (form sửa sách, form duyệt gợi ý). Nhãn bọc ô chọn (không cần id: một trang có nhiều form duyệt).
 * Không 'use client': chỉ render trong client leaf của form.
 */
export function WarningLabelsField({ name, legend, hint, options, defaultValue, error }: Props) {
  return (
    <fieldset className="grid gap-2" aria-invalid={error ? true : undefined}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={defaultValue.includes(option.value)}
              className="size-5 shrink-0 accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {option.label}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  )
}
