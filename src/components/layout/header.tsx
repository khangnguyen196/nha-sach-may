import { MoonIcon, SearchIcon, SunIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getLazyErrorLabels } from '@/components/lazy-error-labels'
import { SearchTrigger } from '@/features/books/components/search-trigger'
import { CartLink } from '@/features/cart/components/cart-link'
import { Link } from '@/i18n/navigation'
import { AccountLink } from './account-link'
import { LocaleSwitcher } from './locale-switcher'
import { ThemeToggle } from './theme-toggle'

export async function Header() {
  const [t, tCommon, lazyError] = await Promise.all([
    getTranslations('layout'),
    getTranslations('common'),
    getLazyErrorLabels(),
  ])

  return (
    <header className="sticky top-0 z-40 h-16 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-focus-ring"
        >
          <LogoMark />
          {/* Màn < 375px không đủ chỗ cho chữ cạnh 5 nút → chỉ còn biểu tượng, tên vẫn đọc được bằng trình đọc màn hình */}
          <span className="font-serif text-base font-semibold max-[374px]:sr-only sm:text-lg">{tCommon('siteName')}</span>
        </Link>

        <div className="flex flex-1 justify-end md:justify-center md:px-6">
          <SearchTrigger
            labels={{ placeholder: t('searchPlaceholder'), open: t('openSearch') }}
            lazyError={lazyError}
            icon={<SearchIcon aria-hidden />}
          />
        </div>

        <div className="flex items-center sm:gap-0.5">
          <LocaleSwitcher labels={{ short: t('switchLocaleShort'), full: t('switchLocale') }} />
          <ThemeToggle
            labels={{ toLight: t('toLightTheme'), toDark: t('toDarkTheme') }}
            icons={{ sun: <SunIcon aria-hidden />, moon: <MoonIcon aria-hidden /> }}
          />
          <CartLink />
          <AccountLink />
        </div>
      </div>
    </header>
  )
}

// Cùng hình với src/app/icon.svg: đám mây trên cuốn sách mở
function LogoMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className="size-7 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.5 10h7.25a2.75 2.75 0 0 0 .4-5.47 3.75 3.75 0 0 0-7.05 1.1A2.2 2.2 0 0 0 12.5 10Z" />
      <path d="M16 15c-2.6-1.9-6.2-2.4-10-1.6v13c3.8-.8 7.4-.3 10 1.6 2.6-1.9 6.2-2.4 10-1.6v-13c-3.8-.8-7.4-.3-10 1.6Z" />
      <path d="M16 15v13" />
    </svg>
  )
}
