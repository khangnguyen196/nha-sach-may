import { Link } from '@/i18n/navigation'
import type { SignInLink } from '@/lib/form-messages'

/** "Đăng nhập lại" trong khối lỗi khi phiên hết giữa chừng; đăng nhập xong quay về đúng trang (`next`, lọc lại ở server) */
export function SignInAgainLink({ signIn }: { signIn: SignInLink }) {
  return (
    <Link
      href={{ pathname: '/login', query: { next: signIn.next } }}
      className="rounded-sm font-medium whitespace-nowrap underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-focus-ring"
    >
      {signIn.label}
    </Link>
  )
}
