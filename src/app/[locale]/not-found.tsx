import { getTranslations } from 'next-intl/server'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

export default async function NotFound() {
  const t = await getTranslations('notFound')

  // Boundary này nằm ở [locale] (ngoài layout của route group) nên tự dựng <main> + footer
  return (
    <>
      <main id="main" className="flex-1">
        <div className="mx-auto flex max-w-reading flex-col items-start px-4 py-24">
          <h1 className="font-serif text-3xl font-medium">{t('title')}</h1>
          <p className="mt-4 text-muted-foreground">{t('description')}</p>
          <Button asChild className="mt-8">
            <Link href="/">{t('backHome')}</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </>
  )
}
