import { getLocale, getTranslations } from 'next-intl/server'
import { getCategories } from '@/features/books/queries'
import { Link } from '@/i18n/navigation'
import { localize } from '@/lib/i18n-db'

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
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t('footerAbout')}</p>
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
                    className="rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
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
        <Copyright text={t('copyright')} />
      </div>
    </footer>
  )
}

/** Footer tối giản cho trang đăng nhập / đăng ký: chỉ dòng bản quyền, không danh mục */
export async function CompactFooter() {
  const t = await getTranslations('layout')
  return (
    <footer className="border-t">
      <Copyright text={t('copyright')} />
    </footer>
  )
}

function Copyright({ text }: { text: string }) {
  return <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-subtle sm:px-6">{text}</p>
}
