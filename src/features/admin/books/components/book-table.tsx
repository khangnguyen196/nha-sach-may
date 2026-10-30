import { BookIcon } from 'lucide-react'
import Image from 'next/image'
import { getFormatter, getTranslations } from 'next-intl/server'
import { AdminLink } from '@/components/admin/admin-link'
import { cn } from '@/lib/utils'
import { LOW_STOCK } from '../params'
import type { AdminBookRow } from '../queries'

const cell = 'px-3 py-2.5 align-middle'
const headCell = 'px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'

/** Bảng sách: tên là link tới trang sửa; trên màn hẹp bảng cuộn ngang trong khung riêng, trang không bị kéo rộng */
export async function BookTable({ books }: { books: AdminBookRow[] }) {
  const [t, tCommon, format] = await Promise.all([
    getTranslations('admin.books.table'),
    getTranslations('admin.common'),
    getFormatter(),
  ])

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-2xl text-sm">
        <caption className="sr-only">{t('caption')}</caption>
        <thead className="border-b bg-surface">
          <tr>
            <th scope="col" className={cn(headCell, 'w-14')}>
              <span className="sr-only">{t('cover')}</span>
            </th>
            <th scope="col" className={headCell}>
              {t('title')}
            </th>
            <th scope="col" className={headCell}>
              {t('category')}
            </th>
            <th scope="col" className={cn(headCell, 'text-right')}>
              {t('price')}
            </th>
            <th scope="col" className={cn(headCell, 'text-right')}>
              {t('stock')}
            </th>
            <th scope="col" className={headCell}>
              {t('status')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {books.map((book) => (
            <tr key={book.id} className="hover:bg-surface">
              <td className={cell}>
                <div className="relative aspect-[2/3] w-9 overflow-hidden rounded-cover bg-surface-raised">
                  {book.cover_url ? (
                    // Tên sách ở ô bên cạnh → alt rỗng (CLAUDE.md → Accessibility)
                    <Image src={book.cover_url} alt="" fill sizes="36px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-subtle">
                      <BookIcon aria-hidden className="size-4" />
                    </span>
                  )}
                </div>
              </td>
              <th scope="row" className={cn(cell, 'max-w-sm text-left font-normal')}>
                <AdminLink
                  href={`/admin/sach/${book.id}`}
                  className="line-clamp-2 rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-focus-ring"
                >
                  {book.title}
                </AdminLink>
                {book.is_featured && <span className="text-xs text-muted-foreground">{t('featured')}</span>}
              </th>
              <td className={cn(cell, 'text-muted-foreground')}>{book.categories?.name ?? t('noCategory')}</td>
              <td className={cn(cell, 'text-right tabular-nums')}>{format.number(book.price, 'price')}</td>
              <td
                className={cn(
                  cell,
                  'text-right tabular-nums',
                  book.stock === 0 ? 'text-sale' : book.stock <= LOW_STOCK && 'text-primary',
                )}
              >
                {book.stock}
              </td>
              <td className={cell}>
                <span
                  className={cn(
                    'inline-flex rounded-sm px-2 py-0.5 text-xs',
                    book.is_active ? 'bg-success/10 text-success' : 'bg-surface-raised text-muted-foreground',
                  )}
                >
                  {book.is_active ? tCommon('active') : tCommon('hidden')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
