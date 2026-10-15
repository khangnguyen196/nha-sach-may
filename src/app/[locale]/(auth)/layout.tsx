import { CompactFooter } from '@/components/layout/footer'

// Form ở giữa trang, không có footer danh mục: ít thứ gây phân tâm khi đang đăng nhập / đăng ký
export default function AuthLayout({ children }: LayoutProps<'/[locale]'>) {
  return (
    <>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-12 sm:items-center sm:py-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <CompactFooter />
    </>
  )
}
