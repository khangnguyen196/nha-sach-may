import { ChevronDownIcon } from 'lucide-react'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { getCategories } from '@/features/books/queries'
import { getPathname, Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getFormMessages } from '@/lib/form-messages'
import { localize } from '@/lib/i18n-db'
import { blockItem, unblockItem } from '../actions'
import { expandBlocks, matchingBlocks, missingWarnings, unblockedTargets, type StoredBlock } from '../blocks'
import { getBookBlockTargets, getMyBlocks, type BookBlockTargets } from '../queries'
import { PrefsButton } from './prefs-button'

// Phần theo phiên của trang sách (chặn theo sở thích, docs/plans/so-thich-canh-bao.md P-C). Mỗi khối nằm trong <Suspense>
// riêng của trang (như MyReview): trang vẫn prerender, BookContent không đọc phiên. Khách và fallback giữ đúng chiều
// cao của trạng thái thu gọn bằng khoảng trống aria-hidden → không CLS khi stream xong.

type Props = { bookId: number; slug: string; locale: Locale }

/**
 * Chỗ giữ sẵn của khối "Sở thích" cuối cột thông tin = summary thu gọn (mt-10 + h-6). Dùng làm fallback của Suspense và
 * cho khách; đổi chiều cao summary thì đổi cả hai.
 */
export function BookPrefsPlaceholder() {
  return <div aria-hidden className="mt-10 h-6" />
}

/** Chỗ giữ sẵn của nút "Ẩn các sách có cảnh báo này" trong khung cảnh báo (mt-4 + nút h-9) */
export function HideWarningsPlaceholder() {
  return <div aria-hidden className="mt-4 h-9" />
}

async function loadBlocks(userId: string, bookId: number) {
  try {
    const [blocks, categories, book] = await Promise.all([getMyBlocks(userId), getCategories(), getBookBlockTargets(bookId)])
    return book ? { blocks, categories, book } : null
  } catch (error) {
    // Lỗi đọc mục chặn: không hiện nút / dòng nhắc (giữ chỗ), không đẩy lỗi lên error boundary của trang sách
    console.error('[prefs] book page:', error instanceof Error ? error.message : 'unknown')
    return null
  }
}

async function buttonProps(slug: string, locale: Locale) {
  const [t, messages] = await Promise.all([
    getTranslations('prefs'),
    getFormMessages([], { signInNext: getPathname({ href: { pathname: '/books/[slug]', params: { slug } }, locale }) }),
  ])
  return { t, shared: { messages, pendingLabel: t('pending'), prefsLink: t('openPage') } }
}

/**
 * Khối cuối cột thông tin. Khách / lỗi → chỗ giữ sẵn. Sách bị chặn → dòng nhắc "Bạn đã chặn …" cho từng mục trúng
 * (danh mục cha thì nêu tên cha, nhãn thì nêu tên nhãn) + "Bỏ chặn" + link trang Sở thích. Còn đích chưa bị chặn →
 * <details> gốc của HTML (mở / đóng không cần JS) với nút "Không muốn thấy …" (tác giả chỉ vai trò author).
 */
export async function BookPrefs({ bookId, slug, locale }: Props) {
  const user = await getCurrentUser()
  if (!user) return <BookPrefsPlaceholder />
  const [data, { t, shared }, tWarnings] = await Promise.all([
    loadBlocks(user.id, bookId),
    buttonProps(slug, locale),
    getTranslations('contentWarnings'),
  ])
  if (!data) return <BookPrefsPlaceholder />
  const { blocks, categories, book } = data

  const nameOf = (block: StoredBlock) => {
    if (block.kind === 'warning') return tWarnings(`labels.${block.warning}`)
    if (block.kind === 'category') {
      const category = categories.find((c) => c.id === block.id)
      return category ? localize(category, 'name', locale) : null
    }
    if (block.kind === 'author') return authorName(book, block.id)
    return book.publishers?.name ?? null
  }
  const matches = matchingBlocks(book, blocks, categories)
  const targets = unblockedTargets(book, expandBlocks(blocks, categories))
  const leaf = targets.categoryId === null ? undefined : categories.find((c) => c.id === targets.categoryId)
  const buttons = [
    ...(leaf ? [{ kind: 'category' as const, id: leaf.id, name: localize(leaf, 'name', locale) }] : []),
    ...targets.authorIds.flatMap((id) => {
      const name = authorName(book, id)
      return name ? [{ kind: 'author' as const, id, name }] : []
    }),
    ...(targets.publisherId !== null && book.publishers
      ? [{ kind: 'publisher' as const, id: targets.publisherId, name: book.publishers.name }]
      : []),
  ]
  if (matches.length === 0 && buttons.length === 0) return <BookPrefsPlaceholder />

  return (
    <div className="mt-10 space-y-4" data-testid="book-prefs">
      {matches.length > 0 && (
        <div className="rounded-lg border bg-surface p-4 text-sm" data-testid="book-prefs-blocked">
          <ul className="space-y-2">
            {matches.map((block) => {
              const values = { kind: t(`kinds.${block.kind}`), name: nameOf(block) ?? t('unknownTarget') }
              return (
                <li key={block.rowId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{t('blocked', values)}</span>
                  <PrefsButton
                    {...shared}
                    action={unblockItem.bind(null, locale, { id: block.rowId })}
                    label={t('unblock')}
                    accessibleLabel={t('unblockLabel', values)}
                    variant="outline"
                    size="sm"
                  />
                </li>
              )
            })}
          </ul>
          <Link
            href="/account/preferences"
            className="mt-3 inline-block rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t('manage')}
          </Link>
        </div>
      )}
      {buttons.length > 0 && (
        <details className="group" data-testid="book-prefs-menu">
          {/* Cao đúng h-6 khi thu gọn: bằng chỗ giữ sẵn (BookPrefsPlaceholder) */}
          <summary className="flex h-6 w-fit max-w-full cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <span className="truncate">{t('summary')}</span>
            <ChevronDownIcon aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <ul className="mt-3 flex flex-col items-start gap-2">
            {buttons.map((button) => (
              <li key={`${button.kind}-${button.id}`}>
                <PrefsButton
                  {...shared}
                  action={blockItem.bind(null, locale, { kind: button.kind, id: button.id })}
                  label={t('block', { kind: t(`kinds.${button.kind}`), name: button.name })}
                  variant="outline"
                  size="lg"
                  className="h-auto min-h-9 py-1.5 text-left whitespace-normal"
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function authorName(book: BookBlockTargets, authorId: number) {
  return book.book_authors.find((ba) => ba.role === 'author' && ba.author_id === authorId)?.authors?.name ?? null
}

/**
 * Chỗ nút "Ẩn các sách có cảnh báo này" trong khung cảnh báo (chỉ render khi sách có nhãn). Khách / lỗi → chỗ giữ sẵn;
 * mọi nhãn của sách đã bị chặn → câu ngắn cùng chiều cao (bỏ chặn ở dòng nhắc cuối cột thông tin); còn nhãn chưa chặn
 * → nút (server tự đọc nhãn của sách, câu 7).
 */
export async function HideWarnings({ bookId, labels, slug, locale }: Props & { labels: readonly string[] }) {
  const user = await getCurrentUser()
  if (!user) return <HideWarningsPlaceholder />
  const [data, { t, shared }] = await Promise.all([loadBlocks(user.id, bookId), buttonProps(slug, locale)])
  if (!data) return <HideWarningsPlaceholder />

  const expanded = expandBlocks(data.blocks, data.categories)
  if (missingWarnings(labels, expanded.warnings).length === 0) {
    return (
      <p className="mt-4 flex min-h-9 items-center text-sm text-muted-foreground" data-testid="warnings-hidden">
        {t('warningsHidden')}
      </p>
    )
  }
  return (
    <div className="mt-4">
      <PrefsButton
        {...shared}
        action={blockItem.bind(null, locale, { kind: 'warnings', bookId })}
        label={t('blockWarnings')}
        variant="outline"
        size="lg"
        className="h-9 px-3"
      />
    </div>
  )
}
