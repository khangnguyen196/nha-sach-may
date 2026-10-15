import { Footer } from '@/components/layout/footer'

export default function ShopLayout({ children }: LayoutProps<'/[locale]'>) {
  return (
    <>
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  )
}
