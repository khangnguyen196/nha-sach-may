import { getLocale, getTranslations } from 'next-intl/server'
import { getCategories } from '@/features/books/queries'
import { Link } from '@/i18n/navigation'
import { localize } from '@/lib/i18n-db'
import { SUPPORT_EMAIL } from '@/lib/support'
import { SupportEmailText } from './support-email-text'

export async function Footer() {
  const [t, tCommon, locale, categories] = await Promise.all([
    getTranslations('layout'),
    getTranslations('common'),
    getLocale(),
    getCategories(),
  ])
  const parents = categories.filter((c) => c.parent_id === null)

  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_2fr] md:py-16">
        <div>
          <p className="font-serif text-lg font-semibold">{tCommon('siteName')}</p>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            {t.rich('footerAbout', {
              // Ghi nguồn ảnh bìa lấy từ Covers API (docs/plans/data.md → Open Library)
              openLibrary: (chunks) => (
                <a
                  href="https://openlibrary.org"
                  className="rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-focus-ring"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
          <Contact text={t('footerContact', { email: SUPPORT_EMAIL })} className="mt-3 text-sm text-muted-foreground" />
          {/* Quyết định 11 của chợ sách cũ: link ở footer + trang tài khoản, không thêm vào header */}
          <p className="mt-3 text-sm">
            <Link
              href="/used-books"
              className="rounded-sm text-muted-foreground underline underline-offset-4 transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-focus-ring"
            >
              {t('footerUsedMarket')}
            </Link>
          </p>
        </div>
        {parents.length > 0 && (
          <nav aria-labelledby="footer-browse">
            <h2 id="footer-browse" className="text-sm font-semibold">
              {t('footerBrowse')}
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {parents.map((category) => (
                <li key={category.id}>
                  <Link
                    href={{ pathname: '/categories/[slug]', params: { slug: category.slug } }}
                    className="rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-focus-ring"
                  >
                    {localize(category, 'name', locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-subtle sm:px-6">{t('copyright')}</p>
      </div>
    </footer>
  )
}

/** Footer tối giản cho trang đăng nhập / đăng ký: chỉ dòng bản quyền, không danh mục */
export async function CompactFooter() {
  const t = await getTranslations('layout')
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-6 gap-y-2 px-4 py-6 text-xs text-subtle sm:px-6">
        <p>{t('copyright')}</p>
        <Contact text={t('footerContact', { email: SUPPORT_EMAIL })} />
      </div>
    </footer>
  )
}

function Contact({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className}>
      <SupportEmailText text={text} />
    </p>
  )
}

