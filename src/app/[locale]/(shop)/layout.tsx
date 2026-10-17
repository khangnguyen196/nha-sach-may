import { Footer } from '@/components/layout/footer'

export default function ShopLayout({ children }: LayoutProps<'/[locale]'>) {
  return (
    <>
      {/* Cao tối thiểu = màn hình trừ header (h-16): footer luôn nằm dưới màn hình đầu, nội dung stream tới (kết quả
          tìm kiếm, giỏ khách đọc localStorage) có đẩy footer cũng không tính vào CLS (đo trên mobile: 0,15 → mục tiêu < 0,1) */}
      <main id="main" className="min-h-[calc(100dvh_-_var(--spacing)*16)] flex-1">
        {children}
      </main>
      <Footer />
    </>
  )
}
