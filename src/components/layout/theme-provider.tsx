import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

// Sáng là mặc định (đợt trang-chu-khuyen-mai, token sáng nằm ở :root nên trước khi script của next-themes chạy trang
// đã sáng: không nháy tối), tối là tùy chọn; không theo hệ điều hành để lần vào đầu ai cũng thấy cùng một giao diện
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
