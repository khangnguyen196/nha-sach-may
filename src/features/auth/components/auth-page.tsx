import type { ReactNode } from 'react'

/** Khung chung của trang đăng nhập / đăng ký / quên & đặt lại mật khẩu: tiêu đề Lora, form, link phụ bên dưới */
export function AuthPage({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <>
      <h1 className="font-serif text-3xl font-medium">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-8">{children}</div>
      {footer && <p className="mt-8 text-sm text-muted-foreground">{footer}</p>}
    </>
  )
}

export const authLinkClass =
  'rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'
