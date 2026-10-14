import { getTranslations } from 'next-intl/server'

export default async function AdminPage() {
  const t = await getTranslations('admin')

  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-4 text-muted-foreground">{t('placeholder')}</p>
    </main>
  )
}
