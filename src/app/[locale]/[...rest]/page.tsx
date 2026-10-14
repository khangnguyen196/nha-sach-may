import { notFound } from 'next/navigation'

// Đường dẫn không khớp route nào dưới [locale] → not-found.tsx của locale (có layout, đúng ngôn ngữ)
export default function CatchAll() {
  notFound()
}
