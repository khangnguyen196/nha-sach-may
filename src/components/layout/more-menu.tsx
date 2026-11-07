'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'

type Props = { label: string; icon: ReactNode; children: ReactNode }

/**
 * Mục trong menu (LocaleSwitcher, ThemeToggle variant "menu"): cao 44px, có chữ. Chỉ là phần đè lên nút ghost cỡ
 * mặc định: nơi dùng gộp qua cn (Button tự gộp) để class đè thay hẳn class cũ, không phụ thuộc thứ tự CSS.
 */
export const MENU_ITEM_CLASS = 'h-11 w-full justify-start gap-3 px-3 font-normal'

/**
 * Menu "⋯" của header dưới md: <details>/<summary> nên mở / đóng được cả trước hydrate (không popover: Safari 16.4 /
 * Firefox < 125 trong mức hỗ trợ của Next 16 chưa có). JS chỉ thêm phần HTML không tự làm: Esc đóng + trả focus về
 * nút, bấm ra ngoài / focus rời menu thì đóng, aria-expanded theo sự kiện toggle. Nội dung menu do Server Component truyền vào.
 */
export function MoreMenu({ label, icon, children }: Props) {
  const ref = useRef<HTMLDetailsElement>(null)
  const [open, setOpen] = useState(false)

  // Mở trước hydrate (details không cần JS) thì sự kiện toggle đã qua: lấy trạng thái thật lúc gắn
  useEffect(() => {
    if (ref.current?.open) setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const details = ref.current
      if (details && event.target instanceof Node && !details.contains(event.target)) details.open = false
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <details
      ref={ref}
      className="relative md:hidden"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      // Focus rời hẳn menu (Tab ra ngoài) thì đóng, không kéo focus về: menu mở còn đè nội dung sau khi bấm link bên
      // ngoài (điều hướng client). relatedTarget null (rời cửa sổ, Safari không focus nút khi bấm) thì giữ nguyên.
      onBlur={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && !event.currentTarget.contains(next)) event.currentTarget.open = false
      }}
      onKeyDown={(event) => {
        const details = event.currentTarget
        if (event.key !== 'Escape' || !details.open) return
        details.open = false
        details.querySelector('summary')?.focus()
      }}
    >
      <summary
        aria-label={label}
        aria-expanded={open}
        className={buttonVariants({
          variant: 'ghost',
          size: 'icon-lg',
          className: 'size-11 cursor-pointer list-none text-muted-foreground [&::-webkit-details-marker]:hidden',
        })}
      >
        {icon}
      </summary>
      <div className="absolute top-full right-0 z-50 mt-1 flex w-max flex-col rounded-lg border bg-surface p-1">
        {children}
      </div>
    </details>
  )
}
